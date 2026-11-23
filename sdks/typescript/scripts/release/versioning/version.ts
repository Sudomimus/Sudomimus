/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Release_Versioning
 * @description Version
 */

import type { HistoryEntry } from "./release-history.ts";
import { isBump, releaseQuarter } from "./release-history.ts";
import { parseNote, planRelease, publicPackages } from "./release-plan.ts";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

export const addChangeset = (root: string, bump: string, summary: string, targets?: readonly string[]): string => {
    if (!isBump(bump) || !summary.trim()) {
        throw new Error("Changeset needs a valid bump and summary");
    }
    const packages = publicPackages(root);
    const selected = targets ?? [];
    if (!selected.length || new Set(selected).size !== selected.length || selected.some((target) => {
        return !packages.some((entry) => {
            return entry.path === target;
        });
    })) {
        throw new Error("Changeset requires explicit, unique public package targets");
    }
    const metadata = Object.fromEntries(selected.map((target) => {
        return [
            target,
            bump,
        ];
    }));
    const source = `---\n${stringify(metadata)}---\n\n${summary.trim()}\n`;
    parseNote(source, "new.md");
    const file = join(root, ".changeset", `${randomUUID()}.md`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source, { flag: "wx" });
    return file;
};
const prepareAndApply = (root: string, options: {
    dryRun?: boolean;
    verbose?: boolean;
} = {}): string => {
    const plan = planRelease(root);
    let description = plan.notes.length
        ? `${plan.packages.length} package releases; changesets: ${plan.notes.length}.\n${plan.packages.map((entry) => {
            return `- ${entry.manifest.name}: ${entry.current} -> ${entry.next} (${entry.bump})`;
        }).join("\n")}`
        : "No pending changesets. Public package versions remain unchanged.";
    if (options.verbose && plan.notes.length) {
        description += `\n${plan.notes.map((note) => {
            return `- ${note.id} (${Object.entries(note.releases).map(([
                target,
                bump,
            ]) => {
                return `${target}: ${bump}`;
            })
                .join(", ")}): ${note.summary}`;
        }).join("\n")}`;
        for (const entry of plan.packages) {
            for (const dependency of entry.dependencyUpdates) {
                description += `\n- ${entry.manifest.name} dependency: ${dependency.name} ${dependency.current} -> ${dependency.next}`;
            }
        }
    }
    if (options.dryRun || !plan.notes.length) {
        return description;
    }
    const writes = new Map<string, string | null>();
    const date = new Date().toISOString()
        .slice(0, 10);
    const quarter = releaseQuarter(date);
    for (const { path, file, manifest, history, current, next, bump, dependencyUpdates } of plan.packages) {
        const quarterDirectory = join(root, path, ".changeset/history", quarter);
        const notes = plan.notes.filter((note) => {
            return Object.hasOwn(note.releases, path);
        });
        writes.set(file, JSON.stringify({
            ...manifest,
            version: next,
        }, null, 4) + "\n");
        const entries: Record<string, HistoryEntry> = { ...history[quarter]?.entries };
        entries[next] = {
            date,
            previousVersion: current,
            bump,
            changes: notes.map((note) => {
                return {
                    id: note.id,
                    bump: note.releases[path]!,
                    digest: note.digest,
                };
            }),
        };
        const changelogFile = join(quarterDirectory, "CHANGELOG.md");
        const existing = existsSync(changelogFile) ? readFileSync(changelogFile, "utf8") : "";
        const previous = existing.replace(/^# Changelog\r?\n(?:\r?\n)?/, "");
        const summaries = [
            ...notes.map((note) => {
                return `- ${note.summary.replace(/\n(?!\n|$)/g, "\n  ")}\n  Change intent: \`${note.id}\` (${note.releases[path]}).`;
            }),
            ...dependencyUpdates.map((dependency) => {
                return `- Update published dependency \`${dependency.name}\` from \`${dependency.current}\` to \`${dependency.next}\`.`;
            }),
        ].join("\n\n");
        writes.set(changelogFile, `# Changelog\n\n## ${next} (${date})\n\n${summaries}\n\n${previous}`.trimEnd() + "\n");
        writes.set(join(quarterDirectory, "ledger.yaml"), stringify(entries));
    }
    for (const note of plan.notes) {
        writes.set(note.file, null);
    }
    const originals = new Map([...writes.keys()].map((file) => {
        return [
            file,
            existsSync(file) ? readFileSync(file, "utf8") : null,
        ];
    }));
    const newDirectories = new Set<string>();
    for (const file of writes.keys()) {
        for (let directory = dirname(file); !existsSync(directory); directory = dirname(directory)) {
            newDirectories.add(directory);
        }
    }
    const write = (file: string, contents: string | null): void => {
        if (contents === null) {
            if (existsSync(file)) {
                rmSync(file, { force: true });
            }
        } else {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, contents);
        }
    };
    try {
        for (const [
            file,
            contents,
        ] of writes) {
            write(file, contents);
        }
    } catch (error) {
        const recoveryErrors: Error[] = [];
        for (const [
            file,
            contents,
        ] of originals) {
            try {
                const exists = existsSync(file);
                const unchanged = contents === null
                    ? !exists
                    : exists && readFileSync(file, "utf8") === contents;
                if (!unchanged) {
                    // Failed writes may already have truncated or partially changed a file.
                    write(file, contents);
                }
            } catch (recoveryError) {
                recoveryErrors.push(new Error(`Could not restore release file: ${file}`, { cause: recoveryError }));
            }
        }
        for (const directory of [...newDirectories].sort((left, right) => {
            return right.length - left.length;
        })) {
            try {
                if (existsSync(directory)) {
                    rmdirSync(directory);
                }
            } catch (recoveryError) {
                recoveryErrors.push(new Error(`Could not remove release directory: ${directory}`, { cause: recoveryError }));
            }
        }
        if (recoveryErrors.length) {
            throw new AggregateError(
                [
                    error,
                    ...recoveryErrors,
                ],
                "Release application failed and rollback was incomplete. Restore the reported paths before retrying.",
                { cause: error },
            );
        }
        throw error;
    }
    return description;
};
export function applyRelease(root: string, options: { dryRun?: boolean; verbose?: boolean } = {}): string {
    if (options.dryRun) return prepareAndApply(root, options);
    const changesets = join(root, ".changeset");
    mkdirSync(changesets, { recursive: true });
    const lock = join(changesets, ".version-lock");
    mkdirSync(lock);
    try {
        return prepareAndApply(root, options);
    } finally {
        rmdirSync(lock);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = resolve(import.meta.dirname, "../../..");
    const [
        command,
        ...options
    ] = process.argv.slice(2);
    if (options.some((option) => {
        return option !== "--dry-run" && option !== "--verbose";
    })) {
        throw new Error("Unknown release option");
    }
    if (command === "add") {
        if (options.length) {
            throw new Error("Use plan to preview pending changesets");
        }
        const requested = process.env.SUDOMIMUS_TS_CHANGESET_TARGET?.trim();
        let targets = requested ? requested.split(",").map((target) => {
            return target.trim();
        }) : undefined;
        if (!targets) {
            if (!process.stdin.isTTY || !process.stdout.isTTY) {
                throw new Error("Changeset requires TARGET outside an interactive terminal. Example: make changeset TARGET=packages/token");
            }
            const { default: checkbox } = await import("@inquirer/checkbox");
            try {
                targets = await checkbox({
                    message: "Select packages to release",
                    choices: publicPackages(root).sort((left, right) => {
                        return left.manifest.name.localeCompare(right.manifest.name);
                    }).map(({ manifest, path }) => {
                        return { name: manifest.name, value: path, description: path };
                    }),
                    required: true,
                    pageSize: 12,
                });
            } catch (error) {
                if (error instanceof Error && error.name === "ExitPromptError") {
                    console.error("Changeset cancelled.");
                    process.exit(130);
                }
                throw error;
            }
        }
        let bump = process.env.SUDOMIMUS_TS_CHANGESET_BUMP || "patch";
        let summary = process.env.SUDOMIMUS_TS_CHANGESET_SUMMARY || "";
        if (!summary && process.stdin.isTTY) {
            const prompt = createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            try {
                bump = await prompt.question(`Bump [${bump}]: `) || bump;
                summary = await prompt.question("Release summary: ");
            } finally {
                prompt.close();
            }
        }
        console.log(addChangeset(root, bump, summary, targets));
    } else if (command === "plan" || command === "apply") {
        console.log(applyRelease(root, {
            dryRun: command === "plan" || options.includes("--dry-run"),
            verbose: options.includes("--verbose"),
        }));
    } else {
        throw new Error("Expected add, plan, or apply [--dry-run] [--verbose]");
    }
}
