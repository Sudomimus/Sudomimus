TS_MAINTENANCE := depcheck update-all update-dependencies update-actions update-self iud ud sort-dependencies sort-workspace sort-all
.PHONY: changeset version-dry-run version-packages pack publish publish-dry-run publish-initial validate-typescript deploy-all-typescript update-dependencies-typescript $(TS_MAINTENANCE)
export SUDOMIMUS_TS_CHANGESET_TARGET = $(TARGET)
export SUDOMIMUS_TS_CHANGESET_BUMP = $(BUMP)
export SUDOMIMUS_TS_CHANGESET_SUMMARY = $(SUMMARY)
export SUDOMIMUS_TS_PUBLISH_TARGET = $(TARGET)
export SUDOMIMUS_TS_INITIAL_PUBLISH_TARGET = $(TARGET)

changeset:
	pnpm -C $(TS_SDK) changeset
version-dry-run:
	pnpm -C $(TS_SDK) version:dry-run $(ARGS)
version-packages:
	pnpm -C $(TS_SDK) version:packages $(ARGS)
pack:
	pnpm -C $(TS_SDK) release:pack
publish:
	pnpm -C $(TS_SDK) release:publish
publish-dry-run:
	pnpm -C $(TS_SDK) release:dry-run
publish-initial:
	pnpm -C $(TS_SDK) release:initial $(ARGS)
validate-typescript:
	pnpm -C $(TS_SDK) validate
$(TS_MAINTENANCE):
	pnpm -C $(TS_SDK) run $@ $(ARGS)

deploy-all-typescript: publish
update-dependencies-typescript: update-dependencies

TS_PACKAGE_DIRS := $(wildcard $(TS_SDK)/packages/*/package.json)
TS_PACKAGES := $(notdir $(patsubst %/,%,$(dir $(TS_PACKAGE_DIRS))))
TS_PUBLISH_TARGETS := $(addprefix publish-,$(TS_PACKAGES))
TS_PREVIEW_TARGETS := $(addprefix publish-dry-run-,$(TS_PACKAGES))
.PHONY: $(TS_PUBLISH_TARGETS) $(TS_PREVIEW_TARGETS)
$(TS_PUBLISH_TARGETS): publish-%:
	SUDOMIMUS_TS_PUBLISH_TARGET=packages/$* pnpm -C $(TS_SDK) release:publish
$(TS_PREVIEW_TARGETS): publish-dry-run-%:
	SUDOMIMUS_TS_PUBLISH_TARGET=packages/$* pnpm -C $(TS_SDK) release:dry-run
