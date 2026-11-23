/**
 * @author WMXPY
 * @package Scripts
 * @namespace Scripts_Workspace
 * @description Package Manifest
 */

export type PackageManifest = {
    readonly name: string;
    readonly private?: boolean;
    readonly version?: string;
    readonly dependencies?: Record<string, string>;
    readonly optionalDependencies?: Record<string, string>;
    readonly peerDependencies?: Record<string, string>;
};
