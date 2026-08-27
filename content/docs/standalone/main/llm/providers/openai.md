---
title: OpenAI
weight: 10
icon: /integrations/providers/bw/openai.svg
description: Route agentgateway LLM traffic to OpenAI's GPT models.
test:
  openai:
  - file: ${versionRoot}/llm/providers/openai.md
    path: openai
---

Configure OpenAI as an LLM provider in agentgateway.

{{< doc-test paths="openai" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: openAI` is a recognized provider and the
#     `name` / `params.apiKey` fields are correct.
#   * With the config loaded, agentgateway serves the wildcard model from the
#     example and resolves it to the `openAI` provider, which is what the `name`
#     and `provider` rows of the settings table describe.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Example request" and any example responses - external dependency; the
#     request needs a real OpenAI API key and bills a live completion, so the test
#     uses a placeholder key.
#   * `params.model` - display-only table row; the example config omits it, so
#     there is nothing on this page to run.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only
# and the config dump still resolve env vars, so a placeholder is enough here.
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
{{< /doc-test >}}

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

{{< doc-test paths="openai" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `openAI` for OpenAI models. |
| `params.model` | The specific OpenAI model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The OpenAI API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

> [!NOTE]
> For advanced routing scenarios that require path-based routing or custom endpoints, use the `gateways` and `routes` configuration format. See the [Routing-based configuration guide]({{< link-hextra path="/llm/configuration-modes/" >}}) for more information.

> [!NOTE]
> To connect Codex to agentgateway, see the [Codex integration page]({{< link-hextra path="/integrations/llm-clients/codex" >}}).

{{< doc-test paths="openai" >}}
# Confirm the config serves the model named in the example and resolves it to
# this provider. First-class providers use built-in upstream defaults, so the
# config dump reports the provider discriminant rather than a host override.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("*") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the wildcard model from the example config is not served"
  exit 1
fi
PROVIDER=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | .provider | keys[0]
  ] | first')
if [ "$PROVIDER" != "openAI" ]; then
  echo "FAIL: expected provider openAI but agentgateway resolved $PROVIDER"
  exit 1
fi
echo "✓ The wildcard model is served and resolves to the openAI provider"
{{< /doc-test >}}
