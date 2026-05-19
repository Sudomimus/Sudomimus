TS_SDK := sdks/typescript

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
