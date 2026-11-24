/**
 * Where this copy of the SDK's command is: `rolarie-studio`, as a file to run with Bun. A
 * site that checks a studio's release runs the command of the SDK it depends on, and this
 * says which file that is, wherever that SDK was found: installed as a package, or a clone
 * a site is being developed against.
 *
 *     spawnSync("bun", [CLI, "check", "--root", folder]);
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import { fileURLToPath } from "node:url";

/** The path of `cli.ts` in this copy of the SDK. */
export const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));
