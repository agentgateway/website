---
title: Gemini
weight: 15
icon: /integrations/providers/bw/gemini.svg
description: Route agentgateway LLM traffic to Google Gemini models.
test:
  gemini:
  - file: ${versionRoot}/integrations/llm/providers/gemini.md
    path: gemini
---

Configure Google Gemini as an LLM provider in agentgateway.

{{< doc-test paths="gemini" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: gemini` is a recognized provider and the
#     `name` / `params.apiKey` fields are correct.
#   * With the config loaded, agentgateway serves the wildcard model from the
#     example and resolves it to the `gemini` provider, which is what the `name`
#     and `provider` rows of the settings table describe.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Example request" and any example responses - external dependency; the
#     request needs a real Gemini API key and bills a live completion, so the test
#     uses a placeholder key.
#   * `params.model` - display-only table row; the example config omits it, so
#     there is nothing on this page to run.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only
# and the config dump still resolve env vars, so a placeholder is enough here.
export GEMINI_API_KEY="${GEMINI_API_KEY:-test}"
{{< /doc-test >}}

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Start agentgateway with the `GEMINI_API_KEY` environment variable set. The UI checks that the variable exists when you save the model.
2. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
3. From the **Provider** dropdown, select **Gemini**.
4. In the **Incoming model match** field, replace the default `gemini/*` with `*`.
5. For the **Provider API key**, select **Env var**, and enter `GEMINI_API_KEY`.
6. Keep **Incoming model** as the **Outgoing model**. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.
7. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: gemini
    params:
      apiKey: "$GEMINI_API_KEY"
```

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `gemini` for Google Gemini models. |
| `params.model` | The specific Gemini model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Gemini API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="gemini" >}}
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

{{< doc-test paths="gemini" >}}
# Confirm the config serves the model named in the example and resolves it to
# this provider. First-class providers use built-in upstream defaults, so the
# config dump reports the provider discriminant rather than a host override.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

# The default `llm.discovery: catalog` expands `*` into catalog model IDs, so
# check for a non-empty list rather than a literal `*`.
SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '.data | length')
if [ "${SERVED:-0}" -eq 0 ]; then
  echo "FAIL: /v1/models lists no models for the example config"
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
echo "✓ The wildcard model is served and resolves to the gemini provider"
{{< /doc-test >}}
