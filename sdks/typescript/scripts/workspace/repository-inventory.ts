import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function workspaceDirectories(root: string) {
    const packages = join(root, "packages");
    return readdirSync(packages, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => ({ directory: join(packages, entry.name) }))
        .filter(({ directory }) => existsSync(join(directory, "package.json")))
        .sort((a, b) => a.directory.localeCompare(b.directory, "en"));
}

export const workspaceLayers = ["packages"] as const;
const maintainedDirectories = ["scripts", "packages", ".changeset", "config"];
const generatedDirectories = new Set([
    "node_modules",
    ".git",
    ".astro",
    ".turbo",
    ".wrangler",
    ".pnpm-store",
    "dist",
    "build",
    "build-dev",
    "coverage",
    "cdk.out",
    "_generated",
    "artifacts",
]);
const environmentFile = /^\.(?:env|dev\.vars)(?:\.|$)/;

export const maintainedFiles = (directory: string): string[] => {
    const root = resolve(directory);
    const files: string[] = [];
    const walk = (path: string): void => {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            if (entry.isSymbolicLink()
                || generatedDirectories.has(entry.name)
                || environmentFile.test(entry.name)) {
                continue;
            }
            const target = join(path, entry.name);
            if (entry.isDirectory()) {
                walk(target);
            } else if (entry.isFile()) {
                files.push(target);
            }
        }
    };
    for (const name of maintainedDirectories) {
        const path = join(root, name);
        if (existsSync(path)) {
            walk(path);
        }
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isFile() && !environmentFile.test(entry.name)) {
            files.push(join(root, entry.name));
        }
    }
    return files.sort();
};
