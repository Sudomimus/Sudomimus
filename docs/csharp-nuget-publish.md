# Publishing the C# SDKs to NuGet

The C# SDKs (`Sudomimus.Token` and `Sudomimus.Native`) are published to
[nuget.org](https://www.nuget.org) under separate package IDs. Each package is
versioned independently via `<Version>` in its `.csproj`.

## Prerequisites

- .NET 8 SDK installed (`dotnet --version` → `8.x` or newer).
- A NuGet API key with push access to the `Sudomimus.*` package IDs, exported
  as `NUGET_API_KEY` for the publish targets.

## Workflow

All commands run from the repository root via the Makefile.

1. **Bump the version.** Edit `<Version>` in
   `sdks/csharp/src/Sudomimus.Token/Sudomimus.Token.csproj` or
   `sdks/csharp/src/Sudomimus.Native/Sudomimus.Native.csproj`. Follow SemVer.
2. **Build and test.**
   ```
   make compile-csharp
   make test-csharp
   ```
3. **Pack and inspect.** The dry-run targets pack the `.nupkg` into
   `sdks/csharp/artifacts/` so you can check its contents before pushing.
   ```
   make publish-dry-run-token-cs       # produces Sudomimus.Token.<ver>.nupkg
   make publish-dry-run-native-cs      # produces Sudomimus.Native.<ver>.nupkg
   ```
   Unzip the `.nupkg` and confirm: the assembly, the `.nuspec`, the README, and
   the LICENSE are all present, and only those files.
4. **Push.** Requires `NUGET_API_KEY` to be set in the environment.
   ```
   NUGET_API_KEY=<key> make publish-token-cs
   NUGET_API_KEY=<key> make publish-native-cs
   ```
   The push uses `--skip-duplicate`, so re-running with the same version is a
   no-op rather than an error.
5. **Tag the release.** After a successful push, tag the commit with
   `csharp/<package>-v<version>` (e.g. `csharp/Sudomimus.Token-v0.1.0`) so the
   release is easy to locate later.

## Troubleshooting

- **`401 Unauthorized` on push.** The API key is missing, expired, or not scoped
  to the package ID being pushed.
- **`409 Conflict`.** The version already exists on nuget.org and was not
  unlisted. Bump `<Version>` and rebuild.
- **Symbols.** Source maps / symbol packages (`.snupkg`) are not currently
  published; debugging is from source via the repo.
