/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Validation_Workflows
 * @description Workflows
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { workflowFiles } from "../maintenance/dependencies/workflow-actions.ts";
import { parse } from "yaml";

type Step = {
    uses?: string;
    with?: Record<string, unknown>;
};
type Job = {
    if?: string;
    needs?: string | string[];
    "runs-on"?: string;
    permissions?: Record<string, string> | string;
    steps?: Step[];
    uses?: string;
};
export const checkWorkflow = (source: string, filename = ""): string[] => {
    const workflow = parse(source) as {
        on?: {
            push?: {
                branches?: string[];
            };
            workflow_dispatch?: unknown;
        };
        permissions?: Record<string, string>;
        jobs?: Record<string, Job>;
    };
    const errors: string[] = [];
    if (workflow.permissions?.contents !== "read" || Object.values(workflow.permissions ?? {}).some((value) => {
        return value !== "read" && value !== "none";
    })) {
        errors.push("Workflow must default to read-only permissions");
    }
    const pin = (reference: string): void => {
        if (!reference.startsWith("./") && !/@[a-f0-9]{40}$/.test(reference)) {
            errors.push(`Action must use a full SHA: ${reference}`);
        }
    };
    for (const [
        name,
        job,
    ] of Object.entries(workflow.jobs ?? {})) {
        const publisher = filename === "publish-typescript.yml" && name === "publish"
            && job.if === "github.ref == 'refs/heads/master' && needs.validate.result == 'success' && needs.release.outputs.publish == 'true'"
            && Array.isArray(job.needs) && job.needs.includes("validate") && job.needs.includes("release")
            && job["runs-on"] === "ubuntu-latest"
            && workflow.jobs?.["validate"]?.uses === "./.github/workflows/ci-typescript.yml"
            && workflow.on?.push?.branches?.length === 1 && workflow.on.push.branches[0] === "master"
            && Object.keys(workflow.on).every((event) => {
                return event === "push" || event === "workflow_dispatch";
            });
        if (job.permissions && (typeof job.permissions === "string" || Object.entries(job.permissions).some(([
            permission,
            value,
        ]) => {
            return value !== "read" && value !== "none"
                && !(publisher && permission === "id-token" && value === "write");
        }))) {
            errors.push("Job cannot elevate permissions");
        }
        if (job.uses) {
            pin(job.uses);
        }
        for (const step of job.steps ?? []) {
            if (!step.uses) {
                continue;
            }
            pin(step.uses);
            if (step.uses.startsWith("pnpm/action-setup@") &&
                step.with?.package_json_file !== "sdks/typescript/package.json") {
                errors.push("pnpm must read the TypeScript workspace packageManager");
            }
            if (step.uses.startsWith("actions/checkout@") && step.with?.["persist-credentials"] !== false) {
                errors.push("Checkout must disable persisted credentials");
            }
            if (step.uses.startsWith("actions/setup-node@") && step.with?.["node-version-file"] !== "sdks/typescript/.nvmrc") {
                errors.push("Node version must come from .nvmrc");
            }
        }
    }
    return errors;
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const directory = resolve(import.meta.dirname, "../../../../.github/workflows");
    const errors = workflowFiles
        .flatMap((file) => {
            return checkWorkflow(readFileSync(resolve(directory, file), "utf8"), file).map((error) => {
                return `${file}: ${error}`;
            });
        });
    if (errors.length) {
        console.error(errors.join("\n")); process.exitCode = 1;
    } else {
        console.log("Workflow policy passed.");
    }
}
