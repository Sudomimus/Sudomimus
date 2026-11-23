/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Release_Versioning
 * @description Release Plan
 */

import { isReservedVersion } from "../../../../../scripts/operation/reserved-version.cjs";
import type { PackageManifest } from "../../workspace/package-manifest.ts";
import { workspaceDirectories } from "../../workspace/repository-inventory.ts";
import type { Bump, HistoryQuarter } from "./release-history.ts";
import { isBump, isRecord, isVersion, readHistory } from "./release-history.ts";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse } from "yaml";

export type Note = {
    id: string;
    releases: Record<string, Bump>;
    summary: string;
    digest: string;
    file: string;
};
export type ReleasePlan = {
    notes: Note[];
    packages: {
        current: string;
        next: string;
        bump: Bump;
        dependencyUpdates: {
            name: string;
            current: string;
            next: string;
        }[];
        path: string;
        file: string;
        manifest: PackageManifest;
        history: Record<string, HistoryQuarter>;
    }[];
};
export const parseNote = (source: string, file: string): Note => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
    if (!match) {
        throw new Error(`Invalid changeset: ${file}`);
    }
    const metadata: unknown = parse(match[1]!);
    const summary = match[2]!.trim();
    const id = basename(file, ".md");
    if (!isRecord(metadata) || !Object.keys(metadata).length || !summary
        || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) {
        throw new Error(`Changeset needs package targets, bumps, and a summary: ${file}`);
    }
    const releases: Record<string, Bump> = {};
    for (const [
        target,
        bump,
    ] of Object.entries(metadata)) {
        if (!/^packages\/[a-z0-9][a-z0-9-]*$/.test(target) || !isBump(bump)) {
            throw new Error(`Invalid changeset target or bump: ${file}/${target}`);
        }
        releases[target] = bump;
    }
    return {
        id,
        releases,
        summary,
        digest: createHash("sha256").update(source)
            .digest("hex"),
        file,
    };
};
export const nextVersion = (version: string, bump: Bump): string => {
    if (!isVersion(version)) {
        throw new Error(`Expected a stable semantic version: ${version}`);
    }
    const [
        major = 0,
        minor = 0,
        patch = 0,
    ] = version.split(".").map(Number);
    const nextMajor = bump === "major" ? major + 1 : major;
    const nextMinor = bump === "major" ? 0 : bump === "minor" ? minor + 1 : minor;
    let nextPatch = bump === "patch" ? patch + 1 : 0;
    let next = `${nextMajor}.${nextMinor}.${nextPatch}`;
    while (isReservedVersion(next)) {
        next = `${nextMajor}.${nextMinor}.${++nextPatch}`;
    }
    return next;
};
export const publicPackages = (root: string) => {
    const packages = workspaceDirectories(root)
        .map(({ directory }) => {
            const file = join(directory, "package.json");
            return {
                path: relative(root, directory).split("\\")
                    .join("/"),
                file,
                manifest: JSON.parse(readFileSync(file, "utf8")) as PackageManifest,
            };
        }).filter(({ manifest }) => !manifest.private);
    if (!packages.length || packages.some(({ manifest }) => {
        return !/^@sudomimus\/[a-z0-9][a-z0-9-]*$/.test(manifest.name);
    })) {
        throw new Error("Expected publishable @sudomimus packages");
    }
    return packages;
};
export const planRelease = (root: string): ReleasePlan => {
    const packages = publicPackages(root).map((entry) => {
        return {
            ...entry,
            history: readHistory(join(root, entry.path)),
        };
    });
    for (const { manifest } of packages) {
        if (!isVersion(manifest.version)) {
            throw new Error(`Expected a stable semantic version: ${manifest.name}@${manifest.version}`);
        }
    }
    const consumed = new Map<string, string>();
    const retired = join(root, "docs/retired-package-history");
    const histories = [
        ...packages.map((entry) => {
            return entry.history;
        }),
        ...(existsSync(retired) ? readdirSync(retired, { withFileTypes: true }) : []).filter((entry) => {
            return entry.isDirectory();
        }).map((entry) => {
            return readHistory(join(retired, entry.name));
        }),
    ];
    for (const archive of histories) {
        for (const history of Object.values(archive)) {
            for (const release of Object.values(history.entries)) {
                for (const change of release.changes) {
                    const previous = consumed.get(change.id);
                    if (previous && previous !== change.digest) {
                        throw new Error(`Changeset has conflicting release history: ${change.id}`);
                    }
                    consumed.set(change.id, change.digest);
                }
            }
        }
    }
    const pending = join(root, ".changeset");
    const notes = (existsSync(pending) ? readdirSync(pending) : []).filter((name) => {
        return name.endsWith(".md") && name !== "README.md";
    }).sort()
        .map((name) => {
            const file = join(pending, name);
            const note = parseNote(readFileSync(file, "utf8"), file);
            for (const target of Object.keys(note.releases)) {
                if (!packages.some((entry) => {
                    return entry.path === target;
                })) {
                    throw new Error(`Unknown changeset target: ${target}`);
                }
            }
            if (consumed.has(note.id)) {
                throw new Error(`Changeset already consumed: ${name}`);
            }
            return note;
        });
    const rank: Record<Bump, number> = {
        patch: 0,
        minor: 1,
        major: 2,
    };
    const bumps = new Map<string, Bump>();
    for (const note of notes) {
        for (const [
            path,
            requested,
        ] of Object.entries(note.releases)) {
            const previous = bumps.get(path);
            if (!previous || rank[requested] > rank[previous]) {
                bumps.set(path, requested);
            }
        }
    }
    const byName = new Map(packages.map((entry) => {
        return [
            entry.manifest.name,
            entry,
        ];
    }));
    const dependencies = new Map(packages.map((entry) => {
        const names = new Map<string, "workspace:*" | "workspace:^">();
        for (const field of [
            "dependencies",
            "optionalDependencies",
            "peerDependencies",
        ] as const) {
            for (const [
                name,
                range,
            ] of Object.entries(entry.manifest[field] ?? {})) {
                if (!range.startsWith("workspace:")) {
                    continue;
                }
                if ((range !== "workspace:*" && range !== "workspace:^") || !byName.has(name)) {
                    throw new Error(`Expected a public workspace:* or workspace:^ release dependency: ${entry.path}/${name}`);
                }
                names.set(name, names.get(name) === "workspace:*" ? "workspace:*" : range);
            }
        }
        return [
            entry.path,
            [...names].map(([
                name,
                range,
            ]) => {
                return {
                    name,
                    range,
                };
            }),
        ];
    }));
    const requiresDependencyRelease = (name: string, range: "workspace:*" | "workspace:^"): boolean => {
        const dependency = byName.get(name)!;
        const bump = bumps.get(dependency.path);
        if (!bump) {
            return false;
        }
        if (range === "workspace:*") {
            return true;
        }
        const current = dependency.manifest.version!.split(".").map(Number);
        const next = nextVersion(dependency.manifest.version!, bump).split(".")
            .map(Number);
        if (current[0] !== 0) {
            return current[0] !== next[0];
        }
        if (current[1] !== 0) {
            return next[0] !== 0 || current[1] !== next[1];
        }
        return current.some((part, index) => {
            return part !== next[index];
        });
    };
    let expanded = true;
    while (expanded) {
        expanded = false;
        for (const entry of packages) {
            if (!bumps.has(entry.path) && dependencies.get(entry.path)!.some(({ name, range }) => {
                return requiresDependencyRelease(name, range);
            })) {
                bumps.set(entry.path, "patch");
                expanded = true;
            }
        }
    }
    const releases: ReleasePlan["packages"] = [];
    for (const entry of packages) {
        const bump = bumps.get(entry.path);
        if (!bump) {
            continue;
        }
        const current = entry.manifest.version!;
        const next = nextVersion(current, bump);
        if (Object.values(entry.history).some((history) => {
            return Object.hasOwn(history.entries, next);
        })) {
            throw new Error(`Release version is already recorded: ${entry.path}@${next}`);
        }
        releases.push({
            ...entry,
            current,
            next,
            bump,
            dependencyUpdates: dependencies.get(entry.path)!.flatMap(({ name }) => {
                const dependency = byName.get(name)!;
                const dependencyBump = bumps.get(dependency.path);
                return dependencyBump ? [
                    {
                        name,
                        current: dependency.manifest.version!,
                        next: nextVersion(dependency.manifest.version!, dependencyBump),
                    },
                ] : [];
            }),
        });
    }
    return {
        packages: releases,
        notes,
    };
};
