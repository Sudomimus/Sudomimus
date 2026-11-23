/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Release_Packing
 * @description Pack
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { publicationTargets } from "../publishing/targets.ts";

const root = resolve(import.meta.dirname, "../../..");
const output = resolve(root, "artifacts");
const packages = publicationTargets(root, process.env.SUDOMIMUS_TS_PUBLISH_TARGET);
execFileSync("pnpm", ["release:prepare"], { cwd: root, stdio: "inherit" });
mkdirSync(output, { recursive: true });
for (const pkg of packages) {
    execFileSync("pnpm", ["pack", "--pack-destination", output], {
        cwd: resolve(root, pkg.path), stdio: "inherit",
    });
}
