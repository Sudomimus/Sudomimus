/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Dependencies
 * @description Sorting
 */

import { workspaceDirectories } from "../../workspace/repository-inventory.ts";
import { repositoryRoot } from "./process.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isMap, isScalar, isSeq, parseDocument, Scalar } from "yaml";

const dependencyFields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];

export const sortManifest = (raw: string) => {
    const manifest = JSON.parse(raw);
    for (const field of dependencyFields) {
        if (manifest[field]) {
            manifest[field] = Object.fromEntries(Object.entries(manifest[field]).sort(([a], [b]) => {
                return a.localeCompare(b, "en");
            }));
        }
    }
    return `${JSON.stringify(manifest, null, 4)}\n`;
};

export const sortWorkspace = (raw: string) => {
    const document = parseDocument(raw);
    if (document.errors.length) {
        throw document.errors[0]!;
    }
    for (const key of [
        "catalog",
        "allowBuilds",
        "packages",
    ]) {
        const node = document.get(key, true);
        if (isMap(node)) {
            for (const item of node.items) {
                if (isScalar(item.key) && typeof item.key.value === "string") {
                    item.key.type = item.key.value.startsWith("@") ? Scalar.QUOTE_DOUBLE : Scalar.PLAIN;
                }
            }
            node.items.sort((a, b) => {
                return String(isScalar(a.key) ? a.key.value : a.key).localeCompare(String(isScalar(b.key) ? b.key.value : b.key), "en");
            });
        }
        if (isSeq(node)) {
            node.items.sort((a, b) => {
                return String(isScalar(a) ? a.value : a).localeCompare(String(isScalar(b) ? b.value : b), "en");
            });
        }
    }
    return String(document);
};

export const sortFiles = (mode: string, dryRun: boolean) => {
    let files = [join(repositoryRoot, "pnpm-workspace.yaml")];
    if (mode === "sort-dependencies") {
        files = [join(repositoryRoot, "package.json")];
        files.push(...workspaceDirectories(repositoryRoot).map((workspace) => {
            return join(workspace.directory, "package.json");
        }));
    }
    for (const file of files) {
        const raw = readFileSync(file, "utf8");
        const sorted = mode === "sort-dependencies" ? sortManifest(raw) : sortWorkspace(raw);
        if (raw === sorted) {
            continue;
        }
        console.log(`${dryRun ? "Would sort" : "Sorting"}: ${file}`);
        if (!dryRun) {
            writeFileSync(file, sorted);
        }
    }
};
