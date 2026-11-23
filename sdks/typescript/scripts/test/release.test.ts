import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addChangeset, applyRelease } from "../release/versioning/version.ts";
import { nextVersion, planRelease } from "../release/versioning/release-plan.ts";
import { readHistory } from "../release/versioning/release-history.ts";
import { publicationTargets } from "../release/publishing/targets.ts";

test("preview and apply propagate exact dependencies and preserve each package's quarterly history", t => {
    const root = mkdtempSync(join(tmpdir(), "sdk-versions-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const packages = { token: {}, session: { "@sudomimus/token": "workspace:*" },
        web: { "@sudomimus/session": "workspace:*" }, native: {} };
    for (const [name, dependencies] of Object.entries(packages)) {
        const dir = join(root, "packages", name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `@sudomimus/${name}`, version: "4.2.0", dependencies }));
    }
    const note = addChangeset(root, "minor", "Support a new token claim.", ["packages/token"]);
    const before = readFileSync(note, "utf8");
    assert.match(applyRelease(root, { dryRun: true }), /3 package releases/);
    assert.equal(readFileSync(note, "utf8"), before);
    assert.equal(existsSync(join(root, "packages/session/.changeset")), false);
    applyRelease(root);
    assert.deepEqual(planRelease(root).notes, []);
    assert.equal(existsSync(note), false);
    for (const [name, version] of [["token", "4.3.0"], ["session", "4.2.1"], ["web", "4.2.1"]]) {
        const dir = join(root, "packages", name);
        const [[quarter, history]] = Object.entries(readHistory(dir));
        assert.equal(history.entries[version].previousVersion, "4.2.0");
        assert.equal(history.entries[version].changes.length, name === "token" ? 1 : 0);
        assert.match(readFileSync(join(dir, ".changeset/history", quarter, "CHANGELOG.md"), "utf8"),
            name === "token" ? /new token claim/ : /published dependency/);
    }
    assert.equal(existsSync(join(root, "packages/native/.changeset")), false);
    writeFileSync(note, before);
    assert.throws(() => planRelease(root), /already consumed/);
    assert.throws(() => publicationTargets(root, "packages/missing"), /Invalid public package/);
    assert.deepEqual(publicationTargets(root, "packages/web,packages/session,packages/token").map(pkg => pkg.name),
        ["@sudomimus/token", "@sudomimus/session", "@sudomimus/web"]);
    assert.equal(nextVersion("1.2.2", "patch"), "1.2.4");
});
