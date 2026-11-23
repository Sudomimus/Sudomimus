/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Dependencies
 * @description Workflow Actions
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repositoryRoot } from "./process.ts";

export const workflowFiles = ["ci-typescript.yml", "publish-typescript.yml"] as const;
const pin = /^(\s*(?:- )?uses:\s+)([\w.-]+\/[\w.-]+)@([0-9a-f]{40})[ \t]+# (v[\w.-]+)[ \t]*$/gm;

export async function updateActions(dryRun: boolean): Promise<number> {
    const changes = new Map<string, string>();
    const latest = new Map<string, { tag: string; sha: string }>();
    for (const filename of workflowFiles) {
        const file = resolve(repositoryRoot, "../../.github/workflows", filename);
        const current = readFileSync(file, "utf8");
        const updated = current.replace(pin, (line, prefix, action, sha) => {
            if (!latest.has(action)) {
                const api = (endpoint: string, field: string) => execFileSync("gh",
                    ["api", "--hostname", "github.com", `repos/${action}/${endpoint}`, "--jq", field],
                    { encoding: "utf8" }).trim();
                const tag = api("releases/latest", ".tag_name");
                if (!/^v?\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Unexpected stable release for ${action}: ${tag}`);
                const commit = api(`commits/${tag}`, ".sha");
                if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`Invalid release commit for ${action}`);
                latest.set(action, { tag, sha: commit });
            }
            const candidate = latest.get(action)!;
            if (candidate.sha === sha) return line;
            console.log(`${filename}: ${action} -> ${candidate.tag} (${candidate.sha})`);
            return `${prefix}${action}@${candidate.sha} # ${candidate.tag}`;
        });
        if (updated !== current) changes.set(file, updated);
    }
    if (!dryRun) for (const [file, content] of changes) writeFileSync(file, content);
    return changes.size;
}
