/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Cloc
 * @description Cloc
 */

import { maintainedFiles, workspaceLayers } from "../../workspace/repository-inventory.ts";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const rootFiles = [
    ".editorconfig",
    ".gitignore",
    ".npmrc",
    ".nvmrc",
    "AGENTS.md",
    "Makefile",
    "README.md",
    "SECURITY.md",
    "package.json",
    "turbo.json",
    "pnpm-workspace.yaml",
    "tsconfig.json",
];
const extension = /\.(?:[cm]?[jt]sx?|css|html|json|md|mk|sql|ya?ml|py|sh|txt)$/;

const formatTitle = (name: string) => {
    return name.split("-").map((word) => {
        if (word === "ui") {
            return "UI";
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    })
        .join(" ");
};

const formatClocIncludes = (files: string[]) => {
    const owners = new Set(files.filter((file) => {
        const parts = file.split("/");
        return parts.length === 3 && workspaceLayers.some((layer) => {
            return layer === parts[0];
        })
            && parts[2] === "package.json";
    }).map((file) => {
        return dirname(file);
    }));
    const rootIncludes = new Set<string>();
    const workspaces = new Map<string, Set<string>>();
    for (const file of files) {
        const [
            layer = "",
            workspace = "",
            entry,
            ...children
        ] = file.split("/");
        const owner = `${layer}/${workspace}`;
        if (!owners.has(owner)) {
            if (workspaceLayers.some((value) => {
                return value === layer;
            }) && entry) {
                rootIncludes.add(owner);
            } else {
                rootIncludes.add(file.includes("/") && !workspaceLayers.some((value) => {
                    return value === layer;
                })
                    ? layer : file);
            }
            continue;
        }
        if (!workspaces.has(owner)) {
            workspaces.set(owner, new Set());
        }
        workspaces.get(owner)!.add(children.length ? `${owner}/${entry}` : file);
    }
    const sections = [
        [
            "# Root",
            ...Array.from(rootIncludes).sort(),
        ].join("\n"),
    ];
    for (const layer of workspaceLayers) {
        const layerOwners = Array.from(workspaces.keys()).filter((owner) => {
            return owner.startsWith(`${layer}/`);
        })
            .sort();
        if (!layerOwners.length) {
            continue;
        }
        sections.push(`# ${formatTitle(layer)}`);
        for (const owner of layerOwners) {
            sections.push([
                `# ${formatTitle(owner.split("/")[1]!)}`,
                ...Array.from(workspaces.get(owner)!).sort(),
            ].join("\n"));
        }
    }
    return `${sections.join("\n\n")}\n`;
};

export const collectClocFiles = (directory: string) => {
    return maintainedFiles(directory).map((file) => {
        return relative(directory, file);
    })
        .filter((file) => {
            return file !== "config/cloc-includes.txt"
            && (file.includes("/") ? extension.test(file) : rootFiles.includes(file));
        });
};

export const refreshCloc = (directory = root) => {
    const files = collectClocFiles(directory);
    mkdirSync(join(directory, "config"), { recursive: true });
    writeFileSync(join(directory, "config/cloc-includes.txt"), formatClocIncludes(files));
    console.log(`Updated cloc list: ${files.length} files.`);
    return files;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [
        mode,
        ...options
    ] = process.argv.slice(2);
    if (![
        "refresh",
        "count",
    ].includes(mode ?? "") || options.length) {
        throw new Error("Usage: cloc.ts refresh|count");
    }
    const files = refreshCloc();
    if (mode === "count") {
        const result = spawnSync("cloc", [
            "--skip-uniqueness",
            "--timeout=0",
            "--list-file=-",
        ], {
            cwd: root,
            input: `${files.join("\n")}\n`,
            stdio: [
                "pipe",
                "inherit",
                "inherit",
            ],
        });
        if (result.error && "code" in result.error && result.error.code === "ENOENT") {
            throw new Error("Install the cloc CLI and make it available on PATH, then run pnpm cloc again.");
        }
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(`cloc failed (${result.status ?? result.signal})`);
        }
    }
}
