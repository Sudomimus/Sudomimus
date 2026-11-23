/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Dependencies
 * @description Updates
 */

import { repositoryRoot, run } from "./process.ts";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";

type OutdatedEntry = {
    readonly latest: string;
    readonly current?: string;
    readonly dependencyType?: string;
};
type Outdated = Record<string, OutdatedEntry>;
type CommandResult = {
    readonly error?: Error;
    readonly status: number | null;
    readonly stdout?: string;
    readonly stderr?: string;
};

export const parseOutdated = (result: CommandResult): Outdated => {
    if (result.error) {
        throw result.error;
    }
    if (![
        0,
        1,
    ].includes(result.status ?? -1)) {
        throw new Error(result.stderr || "pnpm outdated failed");
    }
    const data = JSON.parse(result.stdout ?? "") as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("pnpm outdated must return an object");
    }
    for (const [
        name,
        entry,
    ] of Object.entries(data)) {
        if (!entry || typeof entry !== "object" || !("latest" in entry) || typeof entry.latest !== "string") {
            throw new Error(`Missing latest version for ${name}`);
        }
    }
    return data as Outdated;
};

const outdated = () => {
    const args = [
        "--silent",
        "outdated",
        "-r",
        "--format",
        "json",
    ];
    return parseOutdated(spawnSync("pnpm", args, {
        cwd: repositoryRoot,
        encoding: "utf8",
    }));
};

export const selectUpdates = (data: Outdated, actions: boolean) => {
    return Object.entries(data).filter(([
        , entry,
    ]) => {
        return (entry.dependencyType === "githubAction") === actions;
    });
};

export const updateDependencies = async (dryRun: boolean): Promise<number> => {
    if (!dryRun) {
        run("pnpm", [
            "update",
            "-r",
            "--latest",
        ]);
        return 0;
    }
    const workspace = parseDocument(readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8")).toJS();
    const ignored = workspace.updateConfig?.ignoreDependencies ?? [];
    const updates = selectUpdates(outdated(), false).filter(([name]) => {
        return !ignored.includes(name);
    });
    for (const name of ignored) {
        console.log(`Excluded by update policy: ${name}`);
    }
    for (const [
        name,
        entry,
    ] of updates) {
        console.log(`${name}: ${entry.current} -> ${entry.latest}`);
    }
    if (!updates.length) {
        console.log("All package dependencies are current.");
    }
    return updates.length;
};
