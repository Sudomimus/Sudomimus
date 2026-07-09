/**
 * @author WMXPY
 * @package Scripts
 * @namespace TypescriptSDK
 * @description Update-dependencies
 */

// ONLY RUN IN SCRIPT

const ChildProcess = require("node:child_process");
const Fs = require("node:fs");
const Path = require("node:path");

const workspaceRoot = Path.join(__dirname, "..", "..");
const workspacePath = Path.join(workspaceRoot, "pnpm-workspace.yaml");

const dependencyKeys = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];

const dryRun = process.argv.includes("--dry-run");

const logInfo = (message) => {

    console.log(`[UpdateDependencies] ${message}`);
};

const parseJsonObject = (raw) => {

    const jsonStartIndex = raw.indexOf("{");
    const jsonEndIndex = raw.lastIndexOf("}");

    if (jsonStartIndex === -1
        || jsonEndIndex === -1
        || jsonEndIndex < jsonStartIndex) {
        throw new Error("pnpm outdated did not return a JSON object");
    }

    const jsonPayload = raw.slice(jsonStartIndex, jsonEndIndex + 1);
    const parsed = JSON.parse(jsonPayload);

    if (typeof parsed !== "object"
        || parsed === null
        || Array.isArray(parsed)) {
        throw new Error("pnpm outdated returned a non-object JSON payload");
    }

    return parsed;
};

const runOutdated = () => {

    const result = ChildProcess.spawnSync(
        "pnpm",
        [
            "outdated",
            "-r",
            "--format",
            "json",
        ],
        {
            cwd: workspaceRoot,
            encoding: "utf-8",
        },
    );

    const stdout = result.stdout.trim();

    if (stdout.length === 0) {

        if (result.status === 0) {
            return {};
        }

        throw new Error(result.stderr.trim() || "pnpm outdated failed without JSON output");
    }

    return parseJsonObject(stdout);
};

const unquoteYamlKey = (keyToken) => {

    if (keyToken.startsWith("\"") && keyToken.endsWith("\"")) {
        return keyToken.slice(1, -1);
    }

    return keyToken;
};

const readCatalogEntries = (lines) => {

    const catalogEntries = new Map();

    const catalogLineIndex = lines.findIndex((line) => {
        return line === "catalog:";
    });

    if (catalogLineIndex === -1) {
        return catalogEntries;
    }

    const catalogEntryPattern = /^(\s+)((?:"[^"]+"|[^:\s][^:]*?)):\s+(.+?)\s*$/;

    for (let i = catalogLineIndex + 1; i < lines.length; i++) {

        const line = lines[i];

        if (line.trim().length === 0) {
            continue;
        }

        const indentationLength = line.length - line.trimStart().length;
        if (indentationLength === 0) {
            break;
        }

        const match = line.match(catalogEntryPattern);
        if (!match) {
            continue;
        }

        const [, indentation, keyToken, version] = match;
        catalogEntries.set(unquoteYamlKey(keyToken), {
            indentation,
            keyToken,
            lineIndex: i,
            version,
        });
    }

    return catalogEntries;
};

const getPackageJsonIndentation = (rawContent) => {

    const indentationMatch = rawContent.match(/\n(\s+)"[^"]+":/);
    if (indentationMatch) {
        return indentationMatch[1].length;
    }

    return 4;
};

const readPackageJson = (packageJsonPath) => {

    const rawContent = Fs.readFileSync(packageJsonPath, "utf-8");

    return {
        indentation: getPackageJsonIndentation(rawContent),
        packageJson: JSON.parse(rawContent),
    };
};

const getDependencyDeclaration = (packageJsonPath, packageName) => {

    if (!Fs.existsSync(packageJsonPath)) {
        return null;
    }

    const { packageJson } = readPackageJson(packageJsonPath);

    for (const dependencyKey of dependencyKeys) {

        const dependencies = packageJson[dependencyKey];
        if (typeof dependencies !== "object"
            || dependencies === null
            || Array.isArray(dependencies)) {
            continue;
        }

        const specifier = dependencies[packageName];

        if (typeof specifier === "string") {
            return {
                dependencyKey,
                packageJsonPath,
                specifier,
            };
        }
    }

    return null;
};

const updatePackageJsonDependency = (dependency, packageName, latest) => {

    const { packageJson, indentation } = readPackageJson(dependency.packageJsonPath);
    const dependencies = packageJson[dependency.dependencyKey];

    if (typeof dependencies !== "object"
        || dependencies === null
        || Array.isArray(dependencies)) {
        return false;
    }

    if (dependencies[packageName] === latest) {
        return false;
    }

    dependencies[packageName] = latest;

    if (!dryRun) {
        const updatedContent = `${JSON.stringify(packageJson, null, indentation)}\n`;
        Fs.writeFileSync(dependency.packageJsonPath, updatedContent, "utf-8");
    }

    return true;
};

const formatRelativePath = (absolutePath) => {

    return Path.relative(workspaceRoot, absolutePath);
};

const isCatalogSpecifier = (specifier) => {

    return specifier === "catalog:" || specifier.startsWith("catalog:");
};

const getPackageJsonPath = (dependentPackage) => {

    if (typeof dependentPackage.location !== "string") {
        return null;
    }

    const packageLocation = Path.isAbsolute(dependentPackage.location)
        ? dependentPackage.location
        : Path.join(workspaceRoot, dependentPackage.location);

    return Path.join(packageLocation, "package.json");
};

const outdatedDependencies = runOutdated();
const outdatedEntries = Object.entries(outdatedDependencies);

if (outdatedEntries.length === 0) {
    logInfo("All dependencies are current");
    process.exit(0);
}

const workspaceRawContent = Fs.readFileSync(workspacePath, "utf-8");
const workspaceLines = workspaceRawContent.split("\n");
const catalogEntries = readCatalogEntries(workspaceLines);

const updatedCatalogPackages = [];
const updatedPackageJsonPackages = [];
const skippedPackages = [];

logInfo(`Found ${outdatedEntries.length} outdated dependencies`);

for (const [packageName, outdatedDependency] of outdatedEntries) {

    const latest = outdatedDependency.latest;
    const dependentPackages = outdatedDependency.dependentPackages ?? [];

    if (typeof latest !== "string") {
        skippedPackages.push(`${packageName}: no latest version returned by pnpm`);
        continue;
    }

    if (dependentPackages.length === 0) {

        const catalogEntry = catalogEntries.get(packageName);

        if (catalogEntry && catalogEntry.version !== latest) {
            workspaceLines[catalogEntry.lineIndex] = `${catalogEntry.indentation}${catalogEntry.keyToken}: ${latest}`;
            updatedCatalogPackages.push(`${packageName}: ${catalogEntry.version} -> ${latest}`);
        } else {
            skippedPackages.push(`${packageName}: no dependent package metadata returned by pnpm`);
        }

        continue;
    }

    const directDeclarations = [];
    let requiresCatalogUpdate = false;

    for (const dependentPackage of dependentPackages) {

        const packageJsonPath = getPackageJsonPath(dependentPackage);

        if (packageJsonPath === null) {
            skippedPackages.push(`${packageName}: dependent package location missing`);
            continue;
        }

        const declaration = getDependencyDeclaration(packageJsonPath, packageName);

        if (!declaration) {
            skippedPackages.push(`${packageName}: declaration not found in ${formatRelativePath(packageJsonPath)}`);
            continue;
        }

        if (isCatalogSpecifier(declaration.specifier)) {
            requiresCatalogUpdate = true;
            continue;
        }

        directDeclarations.push(declaration);
    }

    if (requiresCatalogUpdate) {

        const catalogEntry = catalogEntries.get(packageName);

        if (!catalogEntry) {
            skippedPackages.push(`${packageName}: uses catalog: but no catalog entry exists`);
        } else if (catalogEntry.version !== latest) {
            workspaceLines[catalogEntry.lineIndex] = `${catalogEntry.indentation}${catalogEntry.keyToken}: ${latest}`;
            updatedCatalogPackages.push(`${packageName}: ${catalogEntry.version} -> ${latest}`);
        }
    }

    for (const declaration of directDeclarations) {

        const changed = updatePackageJsonDependency(
            declaration,
            packageName,
            latest,
        );

        if (changed) {
            updatedPackageJsonPackages.push(
                `${packageName}: ${declaration.specifier} -> ${latest} (${formatRelativePath(declaration.packageJsonPath)})`,
            );
        }
    }
}

if (updatedCatalogPackages.length > 0 && !dryRun) {
    Fs.writeFileSync(workspacePath, workspaceLines.join("\n"), "utf-8");
}

if (updatedCatalogPackages.length > 0) {
    logInfo(`Updated catalog entries (${updatedCatalogPackages.length})`);
    for (const updatedPackage of updatedCatalogPackages) {
        logInfo(`  ${updatedPackage}`);
    }
}

if (updatedPackageJsonPackages.length > 0) {
    logInfo(`Updated package.json entries (${updatedPackageJsonPackages.length})`);
    for (const updatedPackage of updatedPackageJsonPackages) {
        logInfo(`  ${updatedPackage}`);
    }
}

if (skippedPackages.length > 0) {
    logInfo(`Skipped entries (${skippedPackages.length})`);
    for (const skippedPackage of skippedPackages) {
        logInfo(`  ${skippedPackage}`);
    }
}

if (dryRun) {
    logInfo("Dry run complete; no files were changed");
} else {
    logInfo("Update dependencies complete");
}
