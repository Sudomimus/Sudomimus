# SDK publishing

The package manifests are the release signals. A push to `master` that changes
one of these files starts the matching publish workflow:

| Registry | Manifest | Workflow |
| --- | --- | --- |
| npm | `sdks/typescript/packages/*/package.json` | `publish-typescript.yml` |
| PyPI | `sdks/python/packages/*/pyproject.toml` | `publish-python.yml` |
| NuGet | `sdks/csharp/src/*/*.csproj` | `publish-csharp.yml` |

Each workflow tests its SDK and publishes only packages whose manifest changed
in the push. If several manifests change, packages publish in dependency order.
The workflows do not compare version fields. A manifest edit without a new
package version may fail when the registry rejects the existing version.

Before the first run, add these GitHub Actions repository secrets:

| Secret | Used by |
| --- | --- |
| `NPM_TOKEN` | npm publishing for the `@sudomimus` scope |
| `UV_PUBLISH_TOKEN` | PyPI publishing for the `sudomimus-*` projects |
| `NUGET_API_KEY` | NuGet publishing for the `Sudomimus.*` packages |

Update fixed inter-package dependency versions in the same change as their
dependencies. Update `sdks/python/uv.lock` after changing Python package
metadata; the publish workflow requires the lockfile to be current.

Go keeps its test workflow but has no publish workflow here. Java currently has
local Maven publishing only.
