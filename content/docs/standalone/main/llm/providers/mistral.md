---
title: Mistral AI
weight: 20
icon: /integrations/providers/bw/mistral.svg
description: Route agentgateway LLM traffic to Mistral's models.
test:
  mistral:
  - file: ${versionRoot}/llm/providers/mistral.md
    path: mistral
---

Configure Mistral as an LLM provider in agentgateway.

{{< doc-test paths="mistral" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: mistral` is a recognized provider and the
#     `name` / `params.apiKey` fields are correct.
#   * The `params.baseUrl` row of the settings table: with the config loaded,
#     agentgateway resolves this provider's upstream to the documented default
#     (https://api.mistral.ai/v1), so the table cannot drift from the product without
#     this test failing.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Example request" - external dependency; sending the curl request needs a
#     real Mistral API key and bills a live completion, so the test uses a
#     placeholder key and asserts on resolved config instead.
#   * `params.model` - display-only table row; the example config omits it, so
#     there is nothing on this page to run.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only and
# the config dump still resolve env vars, so a placeholder is enough here.
export MISTRAL_API_KEY="${MISTRAL_API_KEY:-test}"
{{< /doc-test >}}

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: mistral
    params:
      apiKey: "$MISTRAL_API_KEY"
```

{{< doc-test paths="mistral" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: mistral
    params:
      apiKey: "$MISTRAL_API_KEY"
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `mistral`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Mistral API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.mistral.ai/v1`. |

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-small-latest",
    "messages": [{"role": "user", "content": "Hello from Mistral!"}]
  }'
```

{{< doc-test paths="mistral" >}}
# Confirm the default `params.baseUrl` documented in the settings table is what
# agentgateway actually resolves. The admin config dump reports the upstream host
# and path prefix separately, so they are recombined before comparing.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

EXPECTED="https://api.mistral.ai/v1"
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
echo "✓ Provider default baseUrl resolves to $EXPECTED"
{{< /doc-test >}}
