/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Maintenance_Dependencies
 * @description Process
 */

import type { SpawnSyncOptions } from "node:child_process";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const run = (command: string, args: string[], options: SpawnSyncOptions = {}) => {
    const result = spawnSync(command, args, {
        cwd: repositoryRoot,
        stdio: "inherit",
        ...options,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.signal})`);
    }
    return result;
};
