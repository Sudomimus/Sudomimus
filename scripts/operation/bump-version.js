const fs = require("node:fs");
const path = require("node:path");

const BUMP_TYPES = new Set(["patch", "minor", "major"]);

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

const parseVersion = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) {
        fail(`Invalid semver "${version}" — expected MAJOR.MINOR.PATCH`);
    }

    return match.slice(1).map(Number);
};

const computeNextVersion = (current, bumpType) => {
    const [major, minor, patchVersion] = parseVersion(current);

    switch (bumpType) {
        case "patch":
            return `${major}.${minor}.${patchVersion + 1}`;
        case "minor":
            return `${major}.${minor + 1}.0`;
        case "major":
            return `${major + 1}.0.0`;
        default:
            fail(`Invalid bump type "${bumpType}" — expected patch, minor, or major`);
    }
};

const { isReservedVersion } = require("./reserved-version.cjs");

const bumpPatch = (version) => {
    const [major, minor, patchVersion] = parseVersion(version);

    return `${major}.${minor}.${patchVersion + 1}`;
};

const skipReservedVersions = (version) => {
    let result = version;
    while (isReservedVersion(result)) {
        result = bumpPatch(result);
    }

    return result;
};

const readJsonVersion = (content, manifestPath) => {
    let manifest;
    try {
        manifest = JSON.parse(content);
    } catch (error) {
        fail(`Invalid JSON at ${manifestPath}: ${error.message}`);
    }

    if (typeof manifest.version !== "string") {
        fail(`package.json at ${manifestPath} has no string "version" field`);
    }

    return manifest.version;
};

const replaceJsonVersion = (content, currentVersion, nextVersion, manifestPath) => {
    const pattern = /^(\s*"version"\s*:\s*")([^"]+)(")/m;
    const match = pattern.exec(content);
    if (!match || match[2] !== currentVersion) {
        fail(`Unable to locate the top-level "version" field at ${manifestPath}`);
    }

    return content.replace(pattern, `$1${nextVersion}$3`);
};

const readCsprojVersion = (content, manifestPath) => {
    const matches = [...content.matchAll(/<Version>\s*([^<]+?)\s*<\/Version>/g)];
    if (matches.length !== 1) {
        fail(`Expected exactly one <Version> element at ${manifestPath}`);
    }

    return matches[0][1];
};

const replaceCsprojVersion = (content, nextVersion) => (
    content.replace(
        /(<Version>\s*)[^<]+?(\s*<\/Version>)/,
        `$1${nextVersion}$2`,
    )
);

const execute = () => {
    const [, , manifestArg, bumpType] = process.argv;

    if (!manifestArg || !bumpType) {
        fail("Usage: bump-version <package.json|project.csproj> <none|patch|minor|major>");
    }

    if (bumpType === "none") {
        console.log(`${manifestArg}: bump type "none" — nothing to do`);
        return;
    }

    if (!BUMP_TYPES.has(bumpType)) {
        fail(`Invalid bump type "${bumpType}" — expected patch, minor, or major`);
    }

    const manifestPath = path.resolve(manifestArg);
    if (!fs.existsSync(manifestPath)) {
        fail(`Manifest not found at ${manifestPath}`);
    }

    const content = fs.readFileSync(manifestPath, "utf8");
    const isJson = path.basename(manifestPath) === "package.json";
    const isCsproj = path.extname(manifestPath) === ".csproj";
    if (!isJson && !isCsproj) {
        fail(`Unsupported manifest at ${manifestPath} — expected package.json or .csproj`);
    }

    const currentVersion = isJson
        ? readJsonVersion(content, manifestPath)
        : readCsprojVersion(content, manifestPath);
    const computedVersion = computeNextVersion(currentVersion, bumpType);
    const nextVersion = skipReservedVersions(computedVersion);

    if (nextVersion !== computedVersion) {
        console.log(`Skipped reserved version ${computedVersion} -> ${nextVersion}`);
    }

    const updatedContent = isJson
        ? replaceJsonVersion(content, currentVersion, nextVersion, manifestPath)
        : replaceCsprojVersion(content, nextVersion);

    fs.writeFileSync(manifestPath, updatedContent, "utf8");
    console.log(`${manifestArg}: ${currentVersion} -> ${nextVersion} (${bumpType})`);
};

execute();
