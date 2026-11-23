/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Release_Versioning
 * @description Release History
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export type Bump = "patch" | "minor" | "major";
export type HistoryChange = {
    id: string;
    bump: Bump;
    digest: string;
};
export type HistoryEntry = {
    date: string;
    previousVersion: string;
    bump: Bump;
    changes: HistoryChange[];
};
export type HistoryQuarter = {
    entries: Record<string, HistoryEntry>;
};

export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};
export const isBump = (value: unknown): value is Bump => {
    return value === "patch" || value === "minor" || value === "major";
};
export const isVersion = (value: unknown): value is string => {
    return typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);
};

export const releaseQuarter = (date: string): string => {
    return `${date.slice(0, 4)}-Q${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
};

export const readHistory = (directory: string): Record<string, HistoryQuarter> => {
    const folder = join(directory, ".changeset/history");
    if (!existsSync(folder)) {
        return {};
    }
    const history: Record<string, HistoryQuarter> = {};
    const versions = new Set<string>();
    const intents = new Set<string>();
    for (const quarter of readdirSync(folder, { withFileTypes: true }).sort((left, right) => {
        return left.name.localeCompare(right.name, "en");
    })) {
        if (!quarter.isDirectory() || !/^[1-9]\d{3}-Q[1-4]$/.test(quarter.name)) {
            throw new Error(`Invalid release history quarter: ${folder}/${quarter.name}`);
        }
        const quarterDirectory = join(folder, quarter.name);
        const files = readdirSync(quarterDirectory, { withFileTypes: true });
        if (files.length !== 2 || files.some((file) => {
            return !file.isFile() || ![
                "ledger.yaml",
                "CHANGELOG.md",
            ].includes(file.name);
        })) {
            throw new Error(`Invalid release history files: ${quarterDirectory}`);
        }
        const source = readFileSync(join(quarterDirectory, "ledger.yaml"), "utf8");
        const parsed: unknown = parse(source);
        if (!isRecord(parsed)) {
            throw new Error(`Release history must contain a mapping: ${quarterDirectory}/ledger.yaml`);
        }
        const entries: Record<string, HistoryEntry> = {};
        for (const [
            version,
            entry,
        ] of Object.entries(parsed)) {
            if (!isVersion(version) || !isRecord(entry) || !isVersion(entry.previousVersion)
                || !isBump(entry.bump) || !Array.isArray(entry.changes)
                || typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
                || releaseQuarter(entry.date) !== quarter.name
                || !Number.isFinite(Date.parse(entry.date))
                || new Date(entry.date).toISOString()
                    .slice(0, 10) !== entry.date) {
                throw new Error(`Invalid release history entry: ${directory}@${version}`);
            }
            if (versions.has(version)) {
                throw new Error(`Release version is recorded more than once: ${directory}@${version}`);
            }
            versions.add(version);
            const changes: HistoryChange[] = [];
            for (const change of entry.changes as unknown[]) {
                if (!isRecord(change) || typeof change.id !== "string"
                    || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(change.id) || !isBump(change.bump)
                    || Object.hasOwn(change, "summary")
                    || typeof change.digest !== "string" || !/^[a-f0-9]{64}$/.test(change.digest)) {
                    throw new Error(`Invalid release history change: ${directory}@${version}`);
                }
                if (intents.has(change.id)) {
                    throw new Error(`Changeset is recorded more than once: ${directory}/${change.id}`);
                }
                intents.add(change.id);
                changes.push({
                    id: change.id,
                    bump: change.bump,
                    digest: change.digest,
                });
            }
            entries[version] = {
                date: entry.date,
                previousVersion: entry.previousVersion,
                bump: entry.bump,
                changes,
            };
        }
        history[quarter.name] = { entries };
    }
    return history;
};
