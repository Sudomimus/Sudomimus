/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Release_Publishing
 * @description Publish
 */

import { publicationTargets, publishArguments } from "./targets.ts";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PublishOptions = {
    readonly dryRun?: boolean;
};

type PublishRuntime = {
    readonly run: (command: string, args: readonly string[], options: {
        cwd: string;
        stdio: "inherit";
    }) => {
        status: number | null;
        signal?: NodeJS.Signals | null;
        error?: Error;
    };
    readonly log: (message: string) => void;
};

export const publishOptions = (args: readonly string[]): PublishOptions => {
    if (args.some(argument => {
        return argument !== "--dry-run";
    })) {
        throw new Error("Only --dry-run is supported.");
    }
    return { dryRun: args.includes("--dry-run") };
};

export const publishPackages = (
    root: string,
    target: string | undefined,
    options: PublishOptions = {},
    runtime: PublishRuntime = {
        run: spawnSync,
        log: console.log,
    },
): void => {
    const packages = publicationTargets(root, target);
    runtime.log(`Selected packages: ${packages.map(entry => {
        return `${entry.name}@${entry.version}`;
    }).join(", ")}`);
    const commands = [
        ["release:prepare"],
        ...packages.map(entry => publishArguments(entry.name, options.dryRun)),
    ];
    for (const args of commands) {
        runtime.log(`> pnpm ${args.join(" ")}`);
        const result = runtime.run("pnpm", args, {
            cwd: root,
            stdio: "inherit",
        });
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(`pnpm ${args[0]} failed (${result.signal ?? result.status ?? "unknown exit"}). No further steps were run.`);
        }
    }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        publishPackages(
            resolve(import.meta.dirname, "../../.."),
            process.env["SUDOMIMUS_TS_PUBLISH_TARGET"],
            publishOptions(process.argv.slice(2)),
        );
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
