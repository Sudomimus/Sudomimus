#!/usr/bin/env bash
set -euo pipefail

publish=false
if [[ "$GITHUB_EVENT_NAME" == workflow_dispatch ]]; then
    publish=true
else
    if [[ ! "$BEFORE_SHA" =~ ^0+$ ]]; then
        git cat-file -e "$BEFORE_SHA^{commit}"
    fi
    for manifest in sdks/typescript/packages/*/package.json; do
        if jq -e '.private == true' "$manifest" >/dev/null; then continue; fi
        current=$(jq -er '.version | strings' "$manifest")
        if git cat-file -e "$BEFORE_SHA:$manifest" 2>/dev/null; then
            previous=$(git show "$BEFORE_SHA:$manifest" | jq -er .version)
        else
            previous=""
        fi
        if [[ "$current" != "$previous" && "$current" != "0.0.0" ]]; then
            publish=true
            break
        fi
    done
fi
echo "publish=$publish" >> "$GITHUB_OUTPUT"
