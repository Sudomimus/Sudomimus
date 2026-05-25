TS_SDK := sdks/typescript
CSHARP_SDK := sdks/csharp
PYTHON_SDK := sdks/python
PYTHON_SRC := packages/sudomimus-token/src packages/sudomimus-native/src packages/sudomimus-connect/src
NUGET_SOURCE := https://api.nuget.org/v3/index.json
NUGET_PACK_DIR := $(CSHARP_SDK)/artifacts

.PHONY: install
install:
	pnpm -C $(TS_SDK) install

# ---------- Workspace-wide (via turbo) ----------

.PHONY: generate
generate:
	pnpm -C $(TS_SDK) run generate

.PHONY: compile
compile:
	pnpm -C $(TS_SDK) run compile

.PHONY: lint
lint:
	pnpm -C $(TS_SDK) run lint

.PHONY: test
test:
	pnpm -C $(TS_SDK) run test

.PHONY: coverage
coverage:
	pnpm -C $(TS_SDK) run coverage

# ---------- @sudomimus/token ----------

.PHONY: compile-token
compile-token:
	pnpm -C $(TS_SDK) --filter=@sudomimus/token run compile

.PHONY: lint-token
lint-token:
	pnpm -C $(TS_SDK) --filter=@sudomimus/token run lint

.PHONY: test-token
test-token:
	pnpm -C $(TS_SDK) --filter=@sudomimus/token run test

# ---------- @sudomimus/connect ----------

.PHONY: generate-connect
generate-connect:
	pnpm -C $(TS_SDK) --filter=@sudomimus/connect run generate

.PHONY: compile-connect
compile-connect:
	pnpm -C $(TS_SDK) --filter=@sudomimus/connect run compile

.PHONY: lint-connect
lint-connect:
	pnpm -C $(TS_SDK) --filter=@sudomimus/connect run lint

.PHONY: test-connect
test-connect:
	pnpm -C $(TS_SDK) --filter=@sudomimus/connect run test

# ---------- @sudomimus/native ----------

.PHONY: generate-native
generate-native:
	pnpm -C $(TS_SDK) --filter=@sudomimus/native run generate

.PHONY: compile-native
compile-native:
	pnpm -C $(TS_SDK) --filter=@sudomimus/native run compile

.PHONY: lint-native
lint-native:
	pnpm -C $(TS_SDK) --filter=@sudomimus/native run lint

.PHONY: test-native
test-native:
	pnpm -C $(TS_SDK) --filter=@sudomimus/native run test

# ---------- Python SDKs (sudomimus-token + sudomimus-native + sudomimus-connect) ----------
# All -py targets operate on sdks/python/ (uv workspace).

.PHONY: install-py
install-py:
	cd $(PYTHON_SDK) && uv sync

.PHONY: generate-py
generate-py:
	cd $(PYTHON_SDK) && uv run python tasks.py generate

.PHONY: lint-py
lint-py:
	cd $(PYTHON_SDK) && uv run ruff check

.PHONY: typecheck-py
typecheck-py:
	cd $(PYTHON_SDK) && uv run mypy $(PYTHON_SRC)

.PHONY: test-py
test-py:
	cd $(PYTHON_SDK) && uv run pytest

.PHONY: coverage-py
coverage-py:
	cd $(PYTHON_SDK) && uv run pytest \
		--cov=sudomimus_token \
		--cov=sudomimus_native \
		--cov=sudomimus_connect \
		--cov-report=term-missing

# ---------- Publish ----------

.PHONY: publish-dry-run-token
publish-dry-run-token:
	pnpm -C $(TS_SDK) run publish-dry-run:token

.PHONY: publish-dry-run-connect
publish-dry-run-connect:
	pnpm -C $(TS_SDK) run publish-dry-run:connect

.PHONY: publish-token
publish-token:
	pnpm -C $(TS_SDK) run publish:token

.PHONY: publish-connect
publish-connect:
	pnpm -C $(TS_SDK) run publish:connect

# ---------- C# SDK (Sudomimus.Native + Sudomimus.Token) ----------
# All -cs targets operate on sdks/csharp/. NuGet pushes require
# NUGET_API_KEY to be set (see docs/csharp-nuget-publish.md).

.PHONY: restore-csharp
restore-csharp:
	dotnet restore $(CSHARP_SDK)/Sudomimus.slnx

.PHONY: compile-csharp
compile-csharp:
	dotnet build $(CSHARP_SDK)/Sudomimus.slnx -c Release

.PHONY: test-csharp
test-csharp:
	dotnet test $(CSHARP_SDK)/Sudomimus.slnx -c Release

.PHONY: coverage-csharp
coverage-csharp:
	dotnet test $(CSHARP_SDK)/Sudomimus.slnx -c Release \
		--collect:"XPlat Code Coverage" \
		--results-directory $(CSHARP_SDK)/artifacts/coverage

.PHONY: pack-csharp
pack-csharp:
	rm -rf $(NUGET_PACK_DIR)
	dotnet pack $(CSHARP_SDK)/Sudomimus.slnx -c Release -o $(NUGET_PACK_DIR)

# ---------- Sudomimus.Token (C#) ----------

.PHONY: compile-token-cs
compile-token-cs:
	dotnet build $(CSHARP_SDK)/src/Sudomimus.Token/Sudomimus.Token.csproj -c Release

.PHONY: test-token-cs
test-token-cs:
	dotnet test $(CSHARP_SDK)/tests/Sudomimus.Token.Tests/Sudomimus.Token.Tests.csproj -c Release

.PHONY: pack-token-cs
pack-token-cs:
	dotnet pack $(CSHARP_SDK)/src/Sudomimus.Token/Sudomimus.Token.csproj -c Release -o $(NUGET_PACK_DIR)

# ---------- Sudomimus.Native (C#) ----------

.PHONY: compile-native-cs
compile-native-cs:
	dotnet build $(CSHARP_SDK)/src/Sudomimus.Native/Sudomimus.Native.csproj -c Release

.PHONY: test-native-cs
test-native-cs:
	dotnet test $(CSHARP_SDK)/tests/Sudomimus.Native.Tests/Sudomimus.Native.Tests.csproj -c Release

.PHONY: pack-native-cs
pack-native-cs:
	dotnet pack $(CSHARP_SDK)/src/Sudomimus.Native/Sudomimus.Native.csproj -c Release -o $(NUGET_PACK_DIR)

# ---------- C# Publish (NuGet) ----------
# Dry-run targets just pack the .nupkg into $(NUGET_PACK_DIR) so you can
# inspect it before pushing. Push targets require NUGET_API_KEY.

.PHONY: publish-dry-run-token-cs
publish-dry-run-token-cs: pack-token-cs
	@ls -la $(NUGET_PACK_DIR)/Sudomimus.Token.*.nupkg
	@echo ""
	@echo "Inspect the .nupkg above. To publish: make publish-token-cs"

.PHONY: publish-token-cs
publish-token-cs: pack-token-cs
	@test -n "$(NUGET_API_KEY)" || (echo "ERROR: NUGET_API_KEY env var not set" && exit 1)
	dotnet nuget push "$(NUGET_PACK_DIR)/Sudomimus.Token.*.nupkg" \
		--api-key $(NUGET_API_KEY) \
		--source $(NUGET_SOURCE) \
		--skip-duplicate

.PHONY: publish-dry-run-native-cs
publish-dry-run-native-cs: pack-native-cs
	@ls -la $(NUGET_PACK_DIR)/Sudomimus.Native.*.nupkg
	@echo ""
	@echo "Inspect the .nupkg above. To publish: make publish-native-cs"

.PHONY: publish-native-cs
publish-native-cs: pack-native-cs
	@test -n "$(NUGET_API_KEY)" || (echo "ERROR: NUGET_API_KEY env var not set" && exit 1)
	dotnet nuget push "$(NUGET_PACK_DIR)/Sudomimus.Native.*.nupkg" \
		--api-key $(NUGET_API_KEY) \
		--source $(NUGET_SOURCE) \
		--skip-duplicate
