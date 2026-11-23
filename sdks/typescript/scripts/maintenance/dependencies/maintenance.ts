/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Dependencies
 * @description Maintenance
 */

import { updateSelf } from "./package-manager.ts";
import { run } from "./process.ts";
import { sortFiles } from "./sorting.ts";
import { updateActions } from "./workflow-actions.ts";
import { updateDependencies } from "./updates.ts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const main = async (mode: string | undefined, dryRun: boolean) => {
    if (mode === undefined) {
        throw new Error("A maintenance command is required");
    }
    switch (mode) {
        case "depcheck": {
            const dependencies = await updateDependencies(true);
            const actions = await updateActions(true);
            if (dependencies || actions) process.exitCode = 1;
            break;
        }
        case "update-dependencies":
            await updateDependencies(dryRun);
            break;
        case "update-actions":
            await updateActions(dryRun);
            break;
        case "update-all":
            await updateDependencies(dryRun);
            await updateActions(dryRun);
            break;
        case "update-self":
            await updateSelf(dryRun);
            break;
        case "iud":
        case "ud":
            if (dryRun) {
                console.log(mode === "iud" ? "Would run: pnpm install; pnpm update -r; pnpm dedupe; update-self" : "Would run: pnpm update -r; pnpm dedupe");
            } else {
                if (mode === "iud") {
                    run("pnpm", ["install"]);
                }
                run("pnpm", [
                    "update",
                    "-r",
                ]);
                run("pnpm", ["dedupe"]);
            }
            if (mode === "iud") {
                await updateSelf(dryRun);
            }
            break;
        case "sort-dependencies":
        case "sort-workspace":
            sortFiles(mode, dryRun);
            break;
        case "sort-all":
            sortFiles("sort-dependencies", dryRun);
            sortFiles("sort-workspace", dryRun);
            break;
        default:
            throw new Error(`Unknown maintenance command: ${mode}`);
    }
    if (dryRun) {
        console.log("Dry run complete; no repository files were changed.");
    }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [
        mode,
        ...options
    ] = process.argv.slice(2);
    if (options.some((option) => {
        return option !== "--dry-run";
    })) {
        throw new Error("Only --dry-run is supported");
    }
    await main(mode, options.includes("--dry-run"));
}
