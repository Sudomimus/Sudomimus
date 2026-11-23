import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function workspaceDirectories(root: string) {
    const packages = join(root, "packages");
    return readdirSync(packages, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => ({ directory: join(packages, entry.name) }))
        .filter(({ directory }) => existsSync(join(directory, "package.json")))
        .sort((a, b) => a.directory.localeCompare(b.directory, "en"));
}
