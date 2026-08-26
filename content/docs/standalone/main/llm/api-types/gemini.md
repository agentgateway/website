---
title: Gemini
weight: 33
description: Send requests through agentgateway in the native Gemini wire format, including streaming and token counting.
test:
  gemini-inbound-standalone:
  - file: ${versionRoot}/llm/api-types/gemini.md
    path: gemini-inbound-standalone
---

The native Gemini API (`models/{model}:generateContent`) is the wire format that the Gemini and Vertex AI SDKs send.

{{< doc-test paths="gemini-inbound-standalone" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Route type configuration": both example configs are accepted by
#     agentgateway (--validate-only), so `generateContent` and
#     `geminiCountTokens` are recognized route types in the `policies.ai.routes`
#     map, and `provider: gemini` accepts the simplified form.
#   * With the simplified config loaded, agentgateway serves the wildcard model
#     and resolves it to the `gemini` provider.
#   * "Streaming": a `:streamGenerateContent` request without `alt=sse` is
#     rejected with the documented status (400) and the documented
#     INVALID_ARGUMENT body. This check needs no provider, because agentgateway
#     answers it before any upstream call.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The example requests in "Using the API" and their responses - external
#     dependency; each needs a real Gemini API key and bills a live call, so the
#     test uses a placeholder key.
#   * The `tunedModels/` form of the model path - the page mentions it, but
#     exercising it needs a real tuned model on a real project.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example configs read the API key from the environment. --validate-only and
# the alt=sse rejection both resolve before any upstream call, so a placeholder
# is enough here.
export GEMINI_API_KEY="${GEMINI_API_KEY:-test}"
{{< /doc-test >}}

## About

The [Gemini API](https://ai.google.dev/api/generate-content) addresses a model through the request path rather than the request body, as `models/{model}:generateContent`. A client that is built on the Gemini or Vertex AI SDK sends this format directly, so pointing that client at agentgateway needs no OpenAI-compatible shim.

Two route types carry the format:

| Route type | Endpoints |
|------------|-----------|
| `generateContent` | `models/{model}:generateContent` and `models/{model}:streamGenerateContent` |
| `geminiCountTokens` | `models/{model}:countTokens` |

Because the model name comes from the path, any Gemini model works without a per-model entry in your configuration. The `tunedModels/{model}` form is preserved as well.

Native Gemini requests reach Gemini-family backends only, which means the Gemini API, Vertex AI with a Gemini model, or a custom provider that advertises the `generateContent` format. A native Gemini request that is routed to any other provider is rejected with an unsupported-conversion error rather than translated.

> [!NOTE]
> Prompt guards apply to `generateContent` and `streamGenerateContent`. They are skipped for `geminiCountTokens`, which counts tokens and never reaches a model. Thinking configuration in `generationConfig.thinkingConfig`, returned thought parts, and `thoughtsTokenCount` all pass through unchanged.

## Route type configuration

In the simplified `llm` configuration, agentgateway maps the three Gemini path suffixes to their route types, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: gemini
    params:
      apiKey: "$GEMINI_API_KEY"
```

{{< doc-test paths="gemini-inbound-standalone" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: gemini
    params:
      apiKey: "$GEMINI_API_KEY"
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

In the `gateways` and `routes` format, set the route types in the `policies.ai.routes` map. This map is required in this format: traffic that matches no entry is handled as chat completions, and a Gemini request then fails to parse.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 4000
routes:
- backends:
  - ai:
      name: gemini
      provider:
        gemini: {}
  policies:
    ai:
      routes:
        ":generateContent": "generateContent"
        ":streamGenerateContent": "generateContent"
        ":countTokens": "geminiCountTokens"
    backendAuth:
      key: "$GEMINI_API_KEY"
```

The keys are matched as path suffixes, so a leading colon matches the Gemini method suffix whatever version prefix the client sends.

{{< doc-test paths="gemini-inbound-standalone" >}}
cat <<'EOF' > config-explicit.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 4000
routes:
- backends:
  - ai:
      name: gemini
      provider:
        gemini: {}
  policies:
    ai:
      routes:
        ":generateContent": "generateContent"
        ":streamGenerateContent": "generateContent"
        ":countTokens": "geminiCountTokens"
    backendAuth:
      key: "$GEMINI_API_KEY"
EOF
agentgateway -f config-explicit.yaml --validate-only
{{< /doc-test >}}

> [!NOTE]
> For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).

## Using the API

Send a request to `models/{model}` with the Gemini method suffix. Agentgateway forwards the body unchanged and returns the Gemini response shape to the client.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl -X POST 'http://localhost:4000/v1beta/models/gemini-2.5-flash:generateContent' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Say hello"}]
      }
    ]
  }'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations](/docs/standalone/main/integrations/llm-clients/).

{{% /tab %}}
{{< /tabs >}}

To estimate the size of a request before you send it, use the `:countTokens` suffix with the same body.

```shell
curl -X POST 'http://localhost:4000/v1beta/models/gemini-2.5-flash:countTokens' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "How many tokens are in this request?"}]
      }
    ]
  }'
```

## Streaming

Streaming uses the `:streamGenerateContent` suffix, and requires the `alt=sse` query parameter.

```shell
curl -N 'http://localhost:4000/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Count to five"}]
      }
    ]
  }'
```

Without `alt=sse`, the Gemini API streams a JSON array instead of server-sent events, which agentgateway cannot parse incrementally. Rather than fail partway through a response, agentgateway rejects the request before it reaches the provider.

```json
{
  "error": {
    "code": 400,
    "message": "streamGenerateContent requires alt=sse; the JSON-array streaming variant is not supported",
    "status": "INVALID_ARGUMENT"
  }
}
```

{{< doc-test paths="gemini-inbound-standalone" >}}
# Confirm the config serves the wildcard model and resolves it to the gemini
# provider, then confirm the documented alt=sse rejection. The rejection is
# generated locally, so it holds without a real API key.
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
if [ "$PROVIDER" != "gemini" ]; then
  echo "FAIL: expected provider gemini but agentgateway resolved $PROVIDER"
  exit 1
fi

STATUS=$(curl -s --max-time 10 -o /tmp/agw-stream-noalt.json -w '%{http_code}' \
  -X POST 'http://localhost:4000/v1beta/models/gemini-2.5-flash:streamGenerateContent' \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"role":"user","parts":[{"text":"Count to five"}]}]}')
if [ "$STATUS" != "400" ]; then
  echo "FAIL: expected 400 for streamGenerateContent without alt=sse, got $STATUS"
  cat /tmp/agw-stream-noalt.json
  exit 1
fi
if ! jq -e '.error.status == "INVALID_ARGUMENT" and (.error.message | contains("requires alt=sse"))' \
     /tmp/agw-stream-noalt.json >/dev/null; then
  echo "FAIL: the alt=sse rejection body does not match the documented error"
  cat /tmp/agw-stream-noalt.json
  exit 1
fi
echo "✓ The wildcard model resolves to the gemini provider and alt=sse is enforced"
{{< /doc-test >}}

For Gemini-specific provider settings, see the [Gemini]({{< link-hextra path="/llm/providers/gemini/" >}}) and [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}) provider guides.
