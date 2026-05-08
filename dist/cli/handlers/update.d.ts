import type { Config } from "../../config/loader.js";
import type { ParsedFlags } from "../parse-args.js";
export declare function runUpdate(parsed: ParsedFlags, config: Config): Promise<number>;
