import { createInterface } from "node:readline";
import { z } from "zod";
import { GitStorageAdapter } from "../../adapters/git-storage.js";
import { createHandoff } from "../../modules/handoff/index.js";
import { resumeHandoff } from "../../modules/handoff/resume.js";
import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";

const HANDOFF_USAGE = `claude-loadout handoff <subcommand> [options]

Subcommands:
  create   Bundle current uncommitted changes + summary as a shareable handoff
  resume   Apply a teammate's handoff to your current repo
  push     Publish a handoff bundle to a git remote
`;

const CreateSchema = z.object({
  source: z.string().default("."),
  summary: z.string().min(1, "summary path is required"),
  out: z.string().min(1, "output dir is required"),
  author: z.string().optional(),
  "display-name": z.string().optional(),
  id: z.string().optional(),
  "allow-findings": z.union([z.boolean(), z.string()]).optional(),
});

const ResumeSchema = z.object({
  repo: z.string().default("."),
  apply: z.union([z.boolean(), z.string()]).optional(),
  checkout: z.union([z.boolean(), z.string()]).optional(),
  "allow-dirty": z.union([z.boolean(), z.string()]).optional(),
  yes: z.union([z.boolean(), z.string()]).optional(),
});

const PushSchema = z.object({
  remote: z.string().min(1, "--remote <url> is required"),
  message: z.string().optional(),
  push: z.union([z.boolean(), z.string()]).optional(),
});

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === undefined) return fallback;
  return v !== "false" && v !== "0";
}

async function runCreate(parsed: ParsedFlags, config: Config): Promise<number> {
  const flags = CreateSchema.parse(parsed.flags);
  const handle = flags.author ?? config.author?.handle;
  if (!handle) {
    process.stderr.write(
      "error: --author <handle> is required (or set author.handle in claude-loadout.config.json)\n",
    );
    return 1;
  }

  const result = await createHandoff({
    source: flags.source,
    summaryPath: flags.summary,
    outDir: flags.out,
    authorHandle: handle,
    ...(flags["display-name"] && { authorDisplayName: flags["display-name"] }),
    ...(config.author?.url && { authorUrl: config.author.url }),
    ...(flags.id && { id: flags.id }),
    allowFindings: bool(flags["allow-findings"], false),
  });

  if (result.findings.length > 0) {
    process.stderr.write(
      `\nsanitize: found ${result.findings.length} potential issue(s).\n`,
    );
    for (const f of result.findings.slice(0, 20)) {
      process.stderr.write(
        `  ${f.severity.padEnd(6)} ${f.file}:${f.line}  ${f.rule}  ${f.match}\n`,
      );
    }
    if (result.findings.length > 20) {
      process.stderr.write(`  ... and ${result.findings.length - 20} more.\n`);
    }
  }

  process.stdout.write(
    `Created handoff ${result.manifest.id} at ${result.bundleDir}\n` +
      `  branch: ${result.manifest.branch}  baseCommit: ${result.manifest.baseCommit.slice(0, 12)}\n` +
      `  uncommitted changes: ${result.hasUncommittedChanges ? "yes" : "no"}\n`,
  );
  return 0;
}

async function promptYesNo(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${message} [y/N] `, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function runResume(
  parsed: ParsedFlags,
  _config: Config,
): Promise<number> {
  const source = parsed.positional[0];
  if (!source) {
    process.stderr.write(
      "error: handoff resume <source> — pass a git URL, owner/repo, or local bundle path\n",
    );
    return 1;
  }
  const flags = ResumeSchema.parse(parsed.flags);

  const apply = bool(flags.apply, true);
  const yes = bool(flags.yes, false);
  // Interactive only when both stdin and stdout are TTYs and the user didn't
  // pass --yes. CI / slash-command piping bypasses the prompt unchanged.
  const interactive =
    Boolean(process.stdin.isTTY) && Boolean(process.stderr.isTTY) && !yes;

  const warnings: string[] = [];
  const infos: string[] = [];

  // Surface the diff stat (and any other info the module emits) to stderr
  // before the prompt, so the user sees scope before deciding.
  const onInfo = (msg: string) => {
    infos.push(msg);
    process.stderr.write(`${msg}\n`);
  };

  const confirmApply =
    apply && interactive
      ? () =>
          promptYesNo(
            `Apply this patch to ${flags.repo}? (use --yes to skip in scripts)`,
          )
      : undefined;

  const result = await resumeHandoff({
    source,
    repoDir: flags.repo,
    apply,
    checkout: bool(flags.checkout, true),
    allowDirty: bool(flags["allow-dirty"], false),
    onWarn: (msg) => warnings.push(msg),
    onInfo,
    ...(confirmApply && { confirmApply }),
  });

  for (const w of warnings) process.stderr.write(`warn: ${w}\n`);

  process.stdout.write(
    `\nHandoff: ${result.manifest.id}  by @${result.manifest.author.handle}` +
      `  (${result.manifest.createdAt})\n` +
      `Branch: ${result.manifest.branch}  baseCommit: ${result.manifest.baseCommit.slice(0, 12)}\n` +
      (result.branchSwitched
        ? `Switched to branch: ${result.branchSwitched}\n`
        : "") +
      (result.applied
        ? `Applied patch to ${flags.repo}\n`
        : interactive
          ? `Skipped apply (declined at prompt)\n`
          : `No patch applied (review only or no diff in bundle)\n`),
  );
  // Suppress unused-var warnings for collected info (already emitted live).
  void infos;
  return 0;
}

async function runPush(parsed: ParsedFlags, _config: Config): Promise<number> {
  const bundleDir = parsed.positional[0];
  if (!bundleDir) {
    process.stderr.write(
      "error: handoff push <bundle-dir> [--remote <url>] [--message <msg>]\n",
    );
    return 1;
  }
  const flags = PushSchema.parse(parsed.flags);

  const adapter = new GitStorageAdapter();
  await adapter.publish(bundleDir, flags.remote, {
    message: flags.message ?? "claude-loadout: handoff",
    push: bool(flags.push, true),
  });

  process.stdout.write(
    `Pushed ${bundleDir} to ${flags.remote}\n`,
  );
  return 0;
}

export async function runHandoff(
  parsed: ParsedFlags,
  config: Config,
): Promise<number> {
  const sub = parsed.positional[0];
  const rest: ParsedFlags = {
    flags: parsed.flags,
    positional: parsed.positional.slice(1),
  };

  switch (sub) {
    case "create":
      return runCreate(rest, config);
    case "resume":
      return runResume(rest, config);
    case "push":
      return runPush(rest, config);
    default:
      process.stderr.write(HANDOFF_USAGE);
      return 1;
  }
}
