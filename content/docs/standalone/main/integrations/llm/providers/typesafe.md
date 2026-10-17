---
title: TypeSafe
weight: 20
description: Route agentgateway LLM traffic to TypeSafe Jev with the built-in provider preset.
test:
  typesafe:
  - file: ${versionRoot}/integrations/llm/providers/typesafe.md
    path: typesafe
---

Use TypeSafe Jev as an LLM provider in agentgateway. The `typesafe` preset uses the TypeSafe API and the SystemOne provider format for OpenAI Decisions API requests.

{{< doc-test paths="typesafe" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: typesafe`, `visibility: internal`,
#     `llm.virtualModels`, and `params.apiKey` are real fields with the
#     documented nesting.
#   * The `params.baseUrl` row of the settings table: with the config loaded,
#     agentgateway resolves this provider's upstream to the documented default
#     (https://api.typesafe.ai/v1), so the table cannot drift from the product
#     without this test failing.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Next steps" - external dependency; sending a real evaluation request
#     needs a real TypeSafe API key and bills a live evaluation, so the test uses
#     a placeholder key and asserts on resolved config instead.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only and
# the config dump still resolve env vars, so a placeholder is enough here.
export TYPESAFE_API_KEY="${TYPESAFE_API_KEY:-test}"
{{< /doc-test >}}

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: jev-latest
    visibility: internal
    provider: typesafe
    params:
      apiKey: "$TYPESAFE_API_KEY"
  virtualModels:
  - name: guardrail
    routing:
      weighted:
        targets:
        - model: jev-latest
          weight: 100
```

{{< doc-test paths="typesafe" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: jev-latest
    visibility: internal
    provider: typesafe
    params:
      apiKey: "$TYPESAFE_API_KEY"
  virtualModels:
  - name: guardrail
    routing:
      weighted:
        targets:
        - model: jev-latest
          weight: 100
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name that matches incoming requests or virtual model targets. |
| `visibility` | Set to `internal` when clients must not call the TypeSafe model directly. |
| `provider` | The LLM provider, set to `typesafe`. |
| `params.apiKey` | The TypeSafe API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Use this setting to override the provider base URL. The default is `https://api.typesafe.ai/v1`. |
| `virtualModels[].routing.weighted.targets[].model` | The TypeSafe model that the virtual model targets. |

## Next steps

After you run agentgateway with the configuration from the Configuration section, you can send OpenAI Decisions API requests to the virtual model. The configured TypeSafe provider translates the requests to TypeSafe's native `/v1/systemone` API before the requests reach TypeSafe. For a full guardrail workflow that uses this provider, see [Jev]({{< link-hextra path="/integrations/llm/guardrails/jev/" >}}).

{{< doc-test paths="typesafe" >}}
# Confirm the default `params.baseUrl` documented in the settings table is what
# agentgateway actually resolves. The admin config dump reports the upstream host
# and path prefix separately, so they are recombined before comparing.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

EXPECTED="https://api.typesafe.ai/v1"
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | "https://" + (.hostOverride | sub(":443$"; "")) + (.pathPrefix // "")
  ] | first')
if [ "$RESOLVED" != "$EXPECTED" ]; then
  echo "FAIL: settings table documents a default baseUrl of $EXPECTED but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "OK: Provider default baseUrl resolves to $EXPECTED"
{{< /doc-test >}}
