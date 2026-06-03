TS_SDK := sdks/typescript
CSHARP_SDK := sdks/csharp
PYTHON_SDK := sdks/python
PYTHON_SRC := packages/sudomimus-token/src packages/sudomimus-native/src packages/sudomimus-connect/src
GO_SDK := sdks/go
JAVA_SDK := sdks/java
NUGET_SOURCE := https://api.nuget.org/v3/index.json
NUGET_PACK_DIR := $(CSHARP_SDK)/artifacts
GRADLEW := ./gradlew

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

# ---------- Publish (npm) ----------

.PHONY: publish-dry-run-token
publish-dry-run-token:
	pnpm -C $(TS_SDK) run publish-dry-run:token

.PHONY: publish-dry-run-connect
publish-dry-run-connect:
	pnpm -C $(TS_SDK) run publish-dry-run:connect

.PHONY: publish-dry-run-native
publish-dry-run-native:
	pnpm -C $(TS_SDK) run publish-dry-run:native

.PHONY: publish-token
publish-token:
	pnpm -C $(TS_SDK) run publish:token

.PHONY: publish-connect
publish-connect:
	pnpm -C $(TS_SDK) run publish:connect

.PHONY: publish-native
publish-native:
	pnpm -C $(TS_SDK) run publish:native

# ---------- Publish (PyPI) ----------
# `make build-py` produces wheels + sdists for every Python package into
# sdks/python/dist/. The per-package publish-{token,native,connect}-py
# targets push that one package to PyPI via `uv publish`. Set
# UV_PUBLISH_TOKEN (PyPI API token, e.g. `pypi-XXXX…`) before pushing.
# Dry-run targets only build + list the artifacts so you can inspect them.

PYTHON_DIST_DIR := $(PYTHON_SDK)/dist

.PHONY: clean-build-py
clean-build-py:
	rm -rf $(PYTHON_DIST_DIR)

.PHONY: build-py
build-py: clean-build-py
	cd $(PYTHON_SDK) && uv build --package sudomimus-token --out-dir dist
	cd $(PYTHON_SDK) && uv build --package sudomimus-native --out-dir dist
	cd $(PYTHON_SDK) && uv build --package sudomimus-connect --out-dir dist

.PHONY: build-token-py
build-token-py: clean-build-py
	cd $(PYTHON_SDK) && uv build --package sudomimus-token --out-dir dist

.PHONY: build-native-py
build-native-py: clean-build-py
	cd $(PYTHON_SDK) && uv build --package sudomimus-native --out-dir dist

.PHONY: build-connect-py
build-connect-py: clean-build-py
	cd $(PYTHON_SDK) && uv build --package sudomimus-connect --out-dir dist

.PHONY: publish-dry-run-token-py
publish-dry-run-token-py: build-token-py
	@ls -la $(PYTHON_DIST_DIR)/sudomimus_token-*
	@echo ""
	@echo "Inspect the artifacts above. To publish: make publish-token-py"

.PHONY: publish-dry-run-native-py
publish-dry-run-native-py: build-native-py
	@ls -la $(PYTHON_DIST_DIR)/sudomimus_native-*
	@echo ""
	@echo "Inspect the artifacts above. To publish: make publish-native-py"

.PHONY: publish-dry-run-connect-py
publish-dry-run-connect-py: build-connect-py
	@ls -la $(PYTHON_DIST_DIR)/sudomimus_connect-*
	@echo ""
	@echo "Inspect the artifacts above. To publish: make publish-connect-py"

.PHONY: publish-token-py
publish-token-py: build-token-py
	@test -n "$(UV_PUBLISH_TOKEN)" || (echo "ERROR: UV_PUBLISH_TOKEN env var not set" && exit 1)
	cd $(PYTHON_SDK) && uv publish dist/sudomimus_token-*

.PHONY: publish-native-py
publish-native-py: build-native-py
	@test -n "$(UV_PUBLISH_TOKEN)" || (echo "ERROR: UV_PUBLISH_TOKEN env var not set" && exit 1)
	cd $(PYTHON_SDK) && uv publish dist/sudomimus_native-*

.PHONY: publish-connect-py
publish-connect-py: build-connect-py
	@test -n "$(UV_PUBLISH_TOKEN)" || (echo "ERROR: UV_PUBLISH_TOKEN env var not set" && exit 1)
	cd $(PYTHON_SDK) && uv publish dist/sudomimus_connect-*

# ---------- C# SDK (Sudomimus.Connect + Sudomimus.Native + Sudomimus.Token) ----------
# All -cs targets operate on sdks/csharp/. NuGet pushes require
# NUGET_API_KEY to be set (see docs/csharp-nuget-publish.md).

.PHONY: restore-csharp
restore-csharp:
	dotnet restore $(CSHARP_SDK)/Sudomimus.slnx

.PHONY: compile-csharp
compile-csharp:
	dotnet build $(CSHARP_SDK)/Sudomimus.slnx -c Release

.PHONY: lint-csharp
lint-csharp:
	dotnet format $(CSHARP_SDK)/Sudomimus.slnx --verify-no-changes

# `make format-csharp` mutates files in place — use it to fix what
# `lint-csharp` flagged. CI should run lint-csharp, never format-csharp.
.PHONY: format-csharp
format-csharp:
	dotnet format $(CSHARP_SDK)/Sudomimus.slnx

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

.PHONY: lint-token-cs
lint-token-cs:
	dotnet format $(CSHARP_SDK)/src/Sudomimus.Token/Sudomimus.Token.csproj --verify-no-changes

.PHONY: test-token-cs
test-token-cs:
	dotnet test $(CSHARP_SDK)/tests/Sudomimus.Token.Tests/Sudomimus.Token.Tests.csproj -c Release

.PHONY: pack-token-cs
pack-token-cs:
	rm -f $(NUGET_PACK_DIR)/Sudomimus.Token.*.nupkg $(NUGET_PACK_DIR)/Sudomimus.Token.*.snupkg
	dotnet pack $(CSHARP_SDK)/src/Sudomimus.Token/Sudomimus.Token.csproj -c Release -o $(NUGET_PACK_DIR)

# ---------- Sudomimus.Native (C#) ----------

.PHONY: compile-native-cs
compile-native-cs:
	dotnet build $(CSHARP_SDK)/src/Sudomimus.Native/Sudomimus.Native.csproj -c Release

.PHONY: lint-native-cs
lint-native-cs:
	dotnet format $(CSHARP_SDK)/src/Sudomimus.Native/Sudomimus.Native.csproj --verify-no-changes

.PHONY: test-native-cs
test-native-cs:
	dotnet test $(CSHARP_SDK)/tests/Sudomimus.Native.Tests/Sudomimus.Native.Tests.csproj -c Release

.PHONY: pack-native-cs
pack-native-cs:
	rm -f $(NUGET_PACK_DIR)/Sudomimus.Native.*.nupkg $(NUGET_PACK_DIR)/Sudomimus.Native.*.snupkg
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

# ---------- Sudomimus.Connect (C#) ----------

.PHONY: compile-connect-cs
compile-connect-cs:
	dotnet build $(CSHARP_SDK)/src/Sudomimus.Connect/Sudomimus.Connect.csproj -c Release

.PHONY: lint-connect-cs
lint-connect-cs:
	dotnet format $(CSHARP_SDK)/src/Sudomimus.Connect/Sudomimus.Connect.csproj --verify-no-changes

.PHONY: test-connect-cs
test-connect-cs:
	dotnet test $(CSHARP_SDK)/tests/Sudomimus.Connect.Tests/Sudomimus.Connect.Tests.csproj -c Release

.PHONY: pack-connect-cs
pack-connect-cs:
	rm -f $(NUGET_PACK_DIR)/Sudomimus.Connect.*.nupkg $(NUGET_PACK_DIR)/Sudomimus.Connect.*.snupkg
	dotnet pack $(CSHARP_SDK)/src/Sudomimus.Connect/Sudomimus.Connect.csproj -c Release -o $(NUGET_PACK_DIR)

.PHONY: publish-dry-run-connect-cs
publish-dry-run-connect-cs: pack-connect-cs
	@ls -la $(NUGET_PACK_DIR)/Sudomimus.Connect.*.nupkg
	@echo ""
	@echo "Inspect the .nupkg above. To publish: make publish-connect-cs"

.PHONY: publish-connect-cs
publish-connect-cs: pack-connect-cs
	@test -n "$(NUGET_API_KEY)" || (echo "ERROR: NUGET_API_KEY env var not set" && exit 1)
	dotnet nuget push "$(NUGET_PACK_DIR)/Sudomimus.Connect.*.nupkg" \
		--api-key $(NUGET_API_KEY) \
		--source $(NUGET_SOURCE) \
		--skip-duplicate

# ---------- Go SDK (sudomimus-go) ----------
# All -go targets operate on sdks/go/ (single Go module rooted at
# github.com/sudomimus/sudomimus-go).

.PHONY: compile-go
compile-go:
	cd $(GO_SDK) && go build ./...

.PHONY: lint-go
lint-go:
	cd $(GO_SDK) && go vet ./...

.PHONY: test-go
test-go:
	cd $(GO_SDK) && go test ./...

.PHONY: coverage-go
coverage-go:
	cd $(GO_SDK) && go test ./... -coverprofile=coverage.out -covermode=atomic

# ---------- sudomimus-go/token ----------

.PHONY: compile-token-go
compile-token-go:
	cd $(GO_SDK) && go build ./token/...

.PHONY: test-token-go
test-token-go:
	cd $(GO_SDK) && go test ./token/...

# ---------- Java SDK (com.sudomimus:*) ----------
# All -java targets operate on sdks/java/ (Gradle Kotlin DSL multi-module on
# JDK 17). Generate the wrapper once with `cd sdks/java && gradle wrapper`.

.PHONY: compile-java
compile-java:
	cd $(JAVA_SDK) && $(GRADLEW) build -x test

.PHONY: test-java
test-java:
	cd $(JAVA_SDK) && $(GRADLEW) test

.PHONY: coverage-java
coverage-java:
	cd $(JAVA_SDK) && $(GRADLEW) test jacocoTestReport || \
		(echo "NOTE: enable the jacoco plugin in token/build.gradle.kts for coverage reports" && exit 1)

# ---------- com.sudomimus:sudomimus-token (Java) ----------

.PHONY: compile-token-java
compile-token-java:
	cd $(JAVA_SDK) && $(GRADLEW) :token:build -x test

.PHONY: test-token-java
test-token-java:
	cd $(JAVA_SDK) && $(GRADLEW) :token:test

# ---------- Java Publish (Maven) ----------
# Publishes the built jar (+ pom + sources) to the local Maven repository
# (~/.m2/repository). Use this to consume the SDK from another local
# Gradle/Maven project without going through Maven Central. Pushing to
# Maven Central requires additional Gradle config (sonatype creds,
# signing) that isn't wired up here yet.

.PHONY: publish-local-token-java
publish-local-token-java:
	cd $(JAVA_SDK) && $(GRADLEW) :token:publishToMavenLocal
