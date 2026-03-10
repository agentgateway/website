#!/usr/bin/env bash
# Generate a markdown link report from Lychee JSON output.
# Puts newest versions first (e.g. 2.12 before 2.9) so the issue body stays under
# GitHub's limit while showing the most relevant links.
#
# Optional 3rd arg: PUBLIC_DIR (e.g. workspace/public). When set, broken file:// URLs
# that exist under a different version (e.g. path exists in 2.9.x but not main) are
# excluded from the report, since the link is valid in at least one version.
set -euo pipefail

JSON_FILE="${1:?Usage: generate-link-report.sh <lychee.json> [output.md] [public_dir]}"
OUTPUT_FILE="${2:-}"
PUBLIC_DIR="${3:-}"

if [ ! -f "$JSON_FILE" ]; then
  echo "JSON file not found: $JSON_FILE" >&2
  exit 1
fi

# Counts from Lychee JSON (we report unique errors so the summary matches the list below)
REDIRECTS=$(jq -r '.redirects // (.redirect_map | length) // 0' "$JSON_FILE")
if [ "$REDIRECTS" = "null" ]; then REDIRECTS=0; fi

# Failed URLs: extract (url, source) from .error_map so we can show where each link was found
FAIL_SECTION=""
UNIQUE_ERRORS=0
RAW_ERRORS=$(jq -r '.errors // (.error_map | length) // 0' "$JSON_FILE")
if [ "$RAW_ERRORS" = "null" ]; then RAW_ERRORS=0; fi
if [ "${RAW_ERRORS:-0}" -gt 0 ]; then
  # Output "url\tsource" for every (source, url) pair (value can be object or array of objects)
  FAIL_ENTRIES=$(jq -r '
    (.error_map // .fail_map // {} | to_entries[] |
      .key as $source |
      .value as $v |
      if ($v | type) == "string" then "\($v)\t\($source)"
      elif ($v | type) == "object" then "\($v.url // $v.uri // .key)\t\($source)"
      elif ($v | type) == "array" then ($v[] | "\(.url // .uri // "")\t\($source)" | select(length > 0))
      else "\(.key)\t\($source)"
      end
    ) | select(split("\t")[0] | length > 0)
  ' "$JSON_FILE" 2>/dev/null || true)
  if [ -n "$FAIL_ENTRIES" ]; then
    # Get unique URLs and apply version-drift filter (same as before)
    FAIL_URLS=$(echo "$FAIL_ENTRIES" | cut -f1 | sort -u -V -r)
    if [ -n "$PUBLIC_DIR" ] && [ -d "$PUBLIC_DIR" ]; then
      FILTERED=""
      while IFS= read -r url; do
        [ -z "$url" ] && continue
        path="$url"
        if [[ "$url" == file:///* ]]; then
          rest="${url#file://}"
          [[ "$rest" == *"/public/"* ]] && path="public/${rest#*/public/}" || path="${rest#/}"
        fi
        if [[ "$path" == public/*/*/* ]]; then
          IFS='/' read -ra parts <<< "$path"
          product="${parts[1]:-}"
          version="${parts[2]:-}"
          rest="${path#public/$product/$version/}"
          exclude=0
          if [ -n "$rest" ] && [ -d "$PUBLIC_DIR/$product" ]; then
            for other in "$PUBLIC_DIR/$product"/*/; do
              [ -d "$other" ] || continue
              otherver=$(basename "$other")
              [ "$otherver" = "$version" ] && continue
              target="$PUBLIC_DIR/$product/$otherver/$rest"
              if [ -f "$target" ] || [ -f "$target/index.html" ] || [ -d "$target" ]; then
                exclude=1
                break
              fi
            done
          fi
          [ "$exclude" -eq 1 ] && continue
        fi
        FILTERED="${FILTERED}${url}"$'\n'
      done <<< "$FAIL_URLS"
      FAIL_URLS="$FILTERED"
      # Keep only (url, source) entries whose URL was not filtered out
      KEPT=$(echo "$FILTERED" | sort -u)
      FAIL_ENTRIES=$(echo "$FAIL_ENTRIES" | awk -F'\t' 'NR==FNR { kept[$0]=1; next } $1 in kept' <(echo "$KEPT") -)
    fi
    UNIQUE_ERRORS=$(echo "$FAIL_URLS" | grep -c . || true)
    FAIL_SECTION="## Errors (newest versions first)

"
    # Group by URL and collect sources; show each URL with "Found on: ..." (cap at 5 sources, then "and N more")
    MAX_SOURCES=5
    while IFS= read -r url; do
      [ -z "$url" ] && continue
      sources=$(echo "$FAIL_ENTRIES" | awk -F'\t' -v u="$url" '$1==u { print $2 }' | sort -u)
      source_count=$(echo "$sources" | grep -c . || true)
      # Normalize URL for display
      display_url="$url"
      if [[ "$url" == file:///* ]]; then
        rest="${url#file://}"
        [[ "$rest" == *"/public/"* ]] && display_url="public/${rest#*/public/}" || display_url="${rest#/}"
      fi
      FAIL_SECTION="${FAIL_SECTION}- [ ] \`${display_url}\`
"
      # Normalize source paths for display (portable)
      first=1
      n=0
      found_on=""
      while IFS= read -r src; do
        [ -z "$src" ] && continue
        [[ "$src" == file:///* ]] && src="${src#file://}" && [[ "$src" == *"/public/"* ]] && src="public/${src#*/public/}"
        n=$((n+1))
        if [ "$n" -le "$MAX_SOURCES" ]; then
          [ "$first" -eq 1 ] && found_on="  Found on: \`$src\`" && first=0 || found_on="$found_on, \`$src\`"
        fi
      done <<< "$sources"
      [ "$source_count" -gt "$MAX_SOURCES" ] && found_on="$found_on, and $((source_count - MAX_SOURCES)) more"
      [ -n "$found_on" ] && FAIL_SECTION="${FAIL_SECTION}${found_on}
"
    done <<< "$FAIL_URLS"
  else
    FAIL_SECTION="## Errors (newest versions first)

$RAW_ERRORS broken link(s) found. (URL list not in expected JSON shape. Top-level keys: $(jq -r "keys | join(\", \")" "$JSON_FILE" 2>/dev/null || echo "?").)
"
  fi
fi

# Summary uses unique error count so it matches the Errors list
SUMMARY="## Summary

| | Count |
|-|------:|
| Errors | $UNIQUE_ERRORS |
| Redirects | $REDIRECTS |
"

# Redirects: Lychee uses .redirect_map (key=source path, value=array of { url, status: { redirects: { redirects: [{ url, code }, ...] } } })
REDIRECT_SECTION=""
if [ "${REDIRECTS:-0}" -gt 0 ]; then
  # Include source page (redirect_map key) as third field so we can show "Found on"
  REDIRECT_ENTRIES=$(jq -r '
    (.redirect_map // {} | to_entries[] |
      .key as $source |
      .value[]? |
      .url as $original |
      (.status.redirects.redirects[-1].url // .url) as $final |
      "\($original)\t\($final)\t\($source)"
    ) | select(length > 0)
  ' "$JSON_FILE" 2>/dev/null || true)
  if [ -n "$REDIRECT_ENTRIES" ]; then
    REDIRECT_SECTION="## Redirects (newest versions first)

"
    MAX_SOURCES=5
    REDIRECT_URLS=$(echo "$REDIRECT_ENTRIES" | cut -f1 | sort -u -V -r)
    while IFS= read -r original; do
      [ -z "$original" ] && continue
      final=$(echo "$REDIRECT_ENTRIES" | awk -F'\t' -v u="$original" '$1==u { print $2; exit }')
      sources=$(echo "$REDIRECT_ENTRIES" | awk -F'\t' -v u="$original" '$1==u { print $3 }' | sort -u)
      source_count=$(echo "$sources" | grep -c . || true)
      if [ -n "$final" ] && [ "$original" != "$final" ]; then
        REDIRECT_SECTION="${REDIRECT_SECTION}- [ ] \`${original}\` → \`${final}\`
"
      else
        REDIRECT_SECTION="${REDIRECT_SECTION}- [ ] \`${original}\` (redirect)
"
      fi
      first=1
      n=0
      found_on=""
      while IFS= read -r src; do
        [ -z "$src" ] && continue
        [[ "$src" == file:///* ]] && src="${src#file://}" && [[ "$src" == *"/public/"* ]] && src="public/${src#*/public/}"
        n=$((n+1))
        if [ "$n" -le "$MAX_SOURCES" ]; then
          [ "$first" -eq 1 ] && found_on="  Found on: \`$src\`" && first=0 || found_on="$found_on, \`$src\`"
        fi
      done <<< "$sources"
      [ "$source_count" -gt "$MAX_SOURCES" ] && found_on="$found_on, and $((source_count - MAX_SOURCES)) more"
      [ -n "$found_on" ] && REDIRECT_SECTION="${REDIRECT_SECTION}${found_on}
"
    done <<< "$REDIRECT_URLS"
  else
    REDIRECT_SECTION="## Redirects

$REDIRECTS link(s) redirect. (Details not in JSON; check Lychee output.)
"
  fi
fi

REPORT="${SUMMARY}
${FAIL_SECTION}
${REDIRECT_SECTION}"

if [ -n "$OUTPUT_FILE" ]; then
  echo "$REPORT" > "$OUTPUT_FILE"
else
  echo "$REPORT"
fi
