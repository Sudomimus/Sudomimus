/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Headers
 * @description File Headers
 */

import { maintainedFiles, workspaceLayers } from "../../workspace/repository-inventory.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const GROUPS = new Set<string>(workspaceLayers);
const EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
]);
const FIELD = /^ \* @(author|package|namespace|description) (.*)$/gm;
const word = (value: string): string => {
    return value.charAt(0).toUpperCase() + value.slice(1);
};
const location = (root: string, path: string): {
    workspace: string;
    directory: string[];
} | undefined => {
    const parts = relative(root, path).split("/");
    if (/\.d\.(?:ts|mts|cts)$/.test(path)) {
        return undefined;
    }
    if (parts[0] === "scripts") {
        return {
            workspace: parts[0],
            directory: parts.slice(0, -1),
        };
    }
    if (parts.length === 1) {
        return {
            workspace: "root",
            directory: ["Workspace"],
        };
    }
    if (!GROUPS.has(parts[0] ?? "") || parts.length < 3) {
        return undefined;
    }
    const tail = parts.slice(2, -1);
    const directory = tail.length ? tail : ["Workspace"];
    return {
        workspace: parts.slice(0, 2).join("/"),
        directory: tail[0] === "src" ? tail.slice(1) : directory,
    };
};
export const sourcePaths = (root = ROOT): string[] => {
    return maintainedFiles(root).filter((path) => {
        return EXTENSIONS.has(extname(path)) && location(root, path) !== undefined;
    });
};
const split = (content: string): {
    prefix: string;
    body: string;
    old?: string;
    fields: Record<string, string>;
} => {
    const prefix = content.startsWith("#!") ? content.slice(0, content.indexOf("\n") + 1 || content.length) : "";
    const body = content.slice(prefix.length).replace(/^\n*/, "");
    const match = /^\/\*\*[\s\S]*?\*\/\n?/.exec(body);
    const old = match && /@author|@package/.test(match[0]) ? match[0] : undefined;
    return {
        prefix,
        body,
        ...(old === undefined ? {} : { old }),
        fields: Object.fromEntries([...(old ?? "").matchAll(FIELD)].map((field) => {
            return [
                field[1]!,
                field[2]!,
            ];
        })),
    };
};
export const generateHeaders = (root = ROOT, dryRun = false, report: (message: string) => void = console.log): number => {
    const files = sourcePaths(root);
    const packages = new Map<string, Map<string, number>>();
    for (const path of files) {
        const place = location(root, path)!;
        const name = split(readFileSync(path, "utf8")).fields.package;
        if (name) {
            const counts = packages.get(place.workspace) ?? new Map<string, number>();
            counts.set(name, (counts.get(name) ?? 0) + 1);
            packages.set(place.workspace, counts);
        }
    }
    let changed = 0;
    for (const path of files) {
        const place = location(root, path)!;
        const content = readFileSync(path, "utf8");
        const { prefix, body, old, fields } = split(content);
        const inherited = [...(packages.get(place.workspace) ?? [])].sort((a, b) => {
            return b[1] - a[1];
        })[0]?.[0];
        const name = fields.package ?? (place.workspace === ".github" ? "GitHub" : inherited ?? (place.workspace === "root" ? "Root" : place.workspace.split("/").at(-1)!.split("-").map(word)
            .join(" ")));
        const namespace = place.directory.length ? place.directory.map((segment) => {
            return segment.split(/[-_]/).map(word)
                .join("");
        }).join("_") : "Root";
        const description = basename(path, extname(path)).split("-")
            .map(word)
            .join(" ");
        const extras = old?.trimEnd().split("\n")
            .slice(1, -1)
            .filter((line) => {
                return !/^ \* @(author|package|namespace|description) .*$/.test(line);
            }) ?? [];
        const header = [
            "/**",
            " * @author WMXPY",
            ` * @package ${name}`,
            ` * @namespace ${namespace}`,
            ` * @description ${description}`,
            ...extras,
            " */",
            "",
            "",
        ].join("\n");
        const updated = prefix + header + (old ? body.slice(old.length) : body).replace(/^\n*/, "");
        if (updated !== content) {
            changed++;
            if (!dryRun) {
                writeFileSync(path, updated);
            } else {
                report(relative(root, path));
            }
        }
    }
    report(`${dryRun ? "Preview" : "Generate"}: ${files.length} source files, ${changed} headers ${dryRun ? "would be updated" : "updated"}`);
    return changed;
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.slice(2).some((argument) => argument !== "--dry-run")) {
        throw new Error("Expected no arguments or --dry-run");
    }
    generateHeaders(ROOT, process.argv.includes("--dry-run"));
}
