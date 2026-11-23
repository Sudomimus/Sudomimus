import { publicPackages } from "../versioning/release-plan.ts";
import { isVersion } from "../versioning/release-history.ts";

export const publicationTargets = (root: string, target: string | undefined, options: {
    readonly requireSelection?: boolean;
} = {}) => {
    const requested = target?.trim() ? target.split(",").map(value => {
        return value.trim();
    }) : [];
    if ((options.requireSelection && !requested.length) || requested.some(value => {
        return !value;
    })) {
        throw new Error("TARGET must name one or more public packages, separated by commas.");
    }
    const packages = publicPackages(root);
    const selected = requested.length ? requested.map(value => {
        const entry = packages.find(candidate => {
            return candidate.path === value || candidate.manifest.name === value;
        });
        if (!entry) {
            throw new Error(`Invalid public package target: ${value}`);
        }
        return entry;
    }) : packages;
    if (!selected.length || selected.some(entry => {
        return !isVersion(entry.manifest.version);
    })) {
        throw new Error("Selected public packages must each have a stable version.");
    }
    if (new Set(selected.map(entry => {
        return entry.manifest.name;
    })).size !== selected.length) {
        throw new Error("TARGET must not select the same package more than once.");
    }
    const byName = new Map(selected.map(entry => [entry.manifest.name, entry]));
    const ordered: typeof selected = [];
    const finished = new Set<string>();
    const visiting = new Set<string>();
    function visit(entry: typeof selected[number]) {
        const { name } = entry.manifest;
        if (finished.has(name)) return;
        if (visiting.has(name)) throw new Error(`Circular publication dependency at ${name}`);
        visiting.add(name);
        for (const field of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
            for (const dependency of Object.keys(entry.manifest[field] ?? {})) {
                const target = byName.get(dependency);
                if (target) visit(target);
            }
        }
        visiting.delete(name);
        finished.add(name);
        ordered.push(entry);
    }
    selected.forEach(visit);
    return ordered.map(entry => {
        return {
            path: entry.path,
            name: entry.manifest.name,
            version: entry.manifest.version!,
        };
    });
};

// Recursive publish checks the registry for this exact version before uploading.
export function publishArguments(name: string, dryRun = false): string[] {
    return ["--filter", name, "--recursive", "publish", "--no-git-checks",
        "--access", "public", "--registry=https://registry.npmjs.org/", ...(dryRun ? ["--dry-run"] : [])];
}
