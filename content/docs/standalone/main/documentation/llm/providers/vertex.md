---
title: Vertex AI
weight: 15
icon: /integrations/providers/bw/vertex.svg
description: Route agentgateway LLM traffic to models on Google Cloud Vertex AI.
test:
  vertex:
  - file: ${versionRoot}/llm/providers/vertex.md
    path: vertex
---

Configure Google Cloud Vertex AI as an LLM provider in agentgateway.

{{< doc-test paths="vertex" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: vertex` is recognized and
#     `params.model` / `params.vertexProject` / `params.vertexRegion` are correct.
#   * The settings table rows for `name`, `params.model`, `params.vertexProject`,
#     and `params.vertexRegion`: with the config loaded, agentgateway serves the
#     client-facing model name `gemini-2.5-flash` and resolves the upstream to the
#     configured model, project ID, and region. This makes the distinction between
#     `name` (matched in requests) and `params.model` (sent upstream) observable
#     rather than only asserted in prose.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Authentication" - external dependency; Application Default Credentials
#     require a real Google Cloud identity, which the test cannot stand up. The
#     config loads without credentials because ADC is resolved per request.
#   * The `auth.gcp` table row - display-only; the example config omits it and
#     relies on the ADC default.
#   * That a completion reaches Vertex AI - external dependency, as above.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

## Authentication

Before you can use Vertex AI as an LLM provider, you must authenticate by using Google Cloud's [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials). Choose from one of the three methods:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `application_default_credentials.json`
- metadata server

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gemini-2.5-flash
    provider: vertex
    params:
      model: google/gemini-2.5-flash-lite-preview-06-17
      vertexProject: my-project-id
      vertexRegion: us-west2
```

{{< doc-test paths="vertex" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gemini-2.5-flash
    provider: vertex
    params:
      model: google/gemini-2.5-flash-lite-preview-06-17
      vertexProject: my-project-id
      vertexRegion: us-west2
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `vertex` for Google Cloud Vertex AI. |
| `params.model` | The specific Vertex AI model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.vertexProject` | The Google Cloud project ID. |
| `params.vertexRegion` | The Google Cloud region. Defaults to `global` if not specified. |
| `auth.gcp` | Google Cloud authentication configuration. Uses Application Default Credentials (ADC) by default. |

{{< doc-test paths="vertex" >}}
# Confirm the client-facing `name` is served and that `params.model`,
# `params.vertexProject`, and `params.vertexRegion` reach the resolved provider
# config as documented in the settings table.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("gemini-2.5-flash") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the model name gemini-2.5-flash from the example config is not served"
  exit 1
fi
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | .provider.vertex
    | "\(.model)|\(.projectId)|\(.region)"
  ] | first')
EXPECTED="google/gemini-2.5-flash-lite-preview-06-17|my-project-id|us-west2"
if [ "$RESOLVED" != "$EXPECTED" ]; then
  echo "FAIL: expected vertex params $EXPECTED but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "✓ Vertex model, project, and region resolve to the documented values"
{{< /doc-test >}}
