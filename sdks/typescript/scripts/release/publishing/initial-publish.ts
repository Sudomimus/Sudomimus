/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Release_Publishing
 * @description Initial Publish
 */

import { publicationTargets, publishArguments } from "./targets.ts";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const trustDelayMinutes = 3;

type InitialPublishOptions = {
    readonly dryRun?: boolean;
    readonly trustOnly?: boolean;
};

type InitialPublishRuntime = {
    readonly interactive: boolean;
    readonly run: (command: string, args: readonly string[], options: {
        cwd: string;
        stdio: "inherit" | "pipe";
        encoding: "utf8";
    }) => {
        status: number | null;
        stdout?: string | null;
        signal?: NodeJS.Signals | null;
        error?: Error;
    };
    readonly wait: (milliseconds: number) => Promise<unknown>;
    readonly log: (message: string) => void;
};

export const initialPublishOptions = (args: readonly string[]): InitialPublishOptions => {
    if (args.some(argument => {
        return argument !== "--dry-run" && argument !== "--trust-only";
    })) {
        throw new Error("Only --dry-run and --trust-only are supported.");
    }
    return {
        dryRun: args.includes("--dry-run"),
        trustOnly: args.includes("--trust-only"),
    };
};

export const initialPublish = async (
    root: string,
    target: string | undefined,
    options: InitialPublishOptions = {},
    runtime: InitialPublishRuntime = {
        interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
        run: spawnSync,
        wait: setTimeout,
        log: console.log,
    },
): Promise<void> => {
    const packages = publicationTargets(root, target).filter(entry => {
        return target?.trim() ? true : entry.version === "0.0.0";
    });
    if (!packages.length) {
        runtime.log("No public packages at version 0.0.0 need initial publication or trust setup.");
        return;
    }
    if (!existsSync(resolve(root, "../../.github/workflows/publish-typescript.yml"))) {
        throw new Error("The trusted publishing workflow .github/workflows/publish-typescript.yml is missing.");
    }
    if (!options.dryRun && !runtime.interactive) {
        throw new Error("Run make publish-initial from an interactive terminal to complete npm authentication and OTP prompts.");
    }
    const registry = "--registry=https://registry.npmjs.org/";
    const run = (command: string, args: readonly string[], capture = false): string => {
        runtime.log(`> ${command} ${args.join(" ")}`);
        if (options.dryRun) {
            return "";
        }
        const result = runtime.run(command, args, {
            cwd: root,
            stdio: capture ? "pipe" : "inherit",
            encoding: "utf8",
        });
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(`${command} ${args[0]} failed (${result.signal ?? result.status ?? "unknown exit"}). No further steps were run.`);
        }
        return result.stdout ?? "";
    };
    runtime.log(`Selected packages: ${packages.map(entry => {
        return `${entry.name}@${entry.version}`;
    }).join(", ")}`);
    runtime.log("Trusted publisher: Sudomimus/Sudomimus, publish-typescript.yml, direct publishing, no environment.");
    const trustHelp = run("npm", [
        "trust",
        "github",
        "--help",
    ], true);
    if (!options.dryRun && !trustHelp.includes("--allow-publish")) {
        throw new Error("The active npm does not support npm trust github --allow-publish. Run nvm use in sdks/typescript and check npm trust github --help before retrying. If the package is already published, retry with ARGS=--trust-only.");
    }
    if (!options.trustOnly) {
        run("pnpm", [
            "whoami",
            registry,
        ]);
    }
    run("npm", [
        "whoami",
        registry,
    ]);
    if (!options.trustOnly) {
        run("pnpm", ["release:prepare"]);
        for (const entry of packages) {
            run("pnpm", publishArguments(entry.name));
        }
        runtime.log(`Wait ${trustDelayMinutes} minutes before configuring npm trust.`);
        if (!options.dryRun) {
            for (let minutes = trustDelayMinutes; minutes > 0; minutes--) {
                runtime.log(`Trust setup starts in ${minutes} minute(s). Keep this terminal open for authentication.`);
                await runtime.wait(60_000);
            }
        }
    }
    for (const [
        index,
        entry,
    ] of packages.entries()) {
        try {
            run("npm", [
                "trust",
                "github",
                entry.name,
                "--repo",
                "Sudomimus/Sudomimus",
                "--file",
                "publish-typescript.yml",
                "--allow-publish",
                "--yes",
                registry,
            ]);
        } catch (error) {
            runtime.log(`Retry remaining trust setup: make publish-initial TARGET=${packages.slice(index).map(value => {
                return value.name;
            })
                .join(",")} ARGS=--trust-only`);
            throw error;
        }
        if (index < packages.length - 1 && !options.dryRun) {
            await runtime.wait(2_000);
        }
    }
    if (options.dryRun) {
        runtime.log("Dry run complete: no commands, registry writes, authentication, or waits were performed.");
    } else {
        runtime.log(options.trustOnly ? "Trusted publisher setup complete." : "Initial publication and trusted publisher setup complete.");
    }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        await initialPublish(
            resolve(import.meta.dirname, "../../.."),
            process.env["SUDOMIMUS_TS_INITIAL_PUBLISH_TARGET"],
            initialPublishOptions(process.argv.slice(2)),
        );
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
