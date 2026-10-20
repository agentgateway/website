---
title: Cohere
weight: 20
icon: /integrations/providers/bw/cohere.svg
description: Route agentgateway LLM traffic to Cohere's models.
test:
  cohere:
  - file: ${versionRoot}/integrations/llm/providers/cohere.md
    path: cohere
---

Configure Cohere as an LLM provider in agentgateway.

{{< doc-test paths="cohere" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: cohere` is a recognized provider and the
#     `name` / `params.apiKey` fields are correct.
#   * The `params.baseUrl` row of the settings table: with the config loaded,
#     agentgateway resolves this provider's upstream to the documented default
#     (https://api.cohere.ai), so the table cannot drift from the product without
#     this test failing.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Example request" - external dependency; sending the curl request needs a
#     real Cohere API key and bills a live completion, so the test uses a
#     placeholder key and asserts on resolved config instead.
#   * `params.model` - display-only table row; the example config omits it, so
#     there is nothing on this page to run.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only and
# the config dump still resolve env vars, so a placeholder is enough here.
export COHERE_API_KEY="${COHERE_API_KEY:-test}"
{{< /doc-test >}}

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Start agentgateway with the `COHERE_API_KEY` environment variable set. The UI checks that the variable exists when you save the model.
2. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
3. From the **Provider** dropdown, select **Cohere**.
4. In the **Incoming model match** field, replace the default `cohere/*` with `*`.
5. For the **Provider API key**, select **Env var**, and enter `COHERE_API_KEY`.
6. Keep **Incoming model** as the **Outgoing model**. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-cohere.png" srcDark="img/ui-llm-add-model-cohere-dark.png" >}}

7. Click **Save model**.

The form has no field for `params.baseUrl`. To override the base URL, click the **Raw** icon (`<>`) in the drawer header and add the field, or use the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: cohere
    params:
      apiKey: "$COHERE_API_KEY"
```

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `cohere`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Cohere API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.cohere.ai`. |
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="cohere" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: cohere
    params:
      apiKey: "$COHERE_API_KEY"
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "command-r-plus",
    "messages": [{"role": "user", "content": "Hello from Cohere!"}]
  }'
```

{{< doc-test paths="cohere" >}}
# Confirm the default `params.baseUrl` documented in the settings table is what
# agentgateway actually resolves. The admin config dump reports the upstream host
# and path prefix separately, so they are recombined before comparing. Cohere's
# default base URL is the only one with no path, and agentgateway normalizes that
# empty path to `/` in the dump, so a lone `/` prefix is dropped before comparing.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

EXPECTED="https://api.cohere.ai"
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint
    | "https://" + (.hostOverride | sub(":443$"; "")) + ((.pathPrefix // "") | sub("^/$"; ""))
  ] | first')
if [ "$RESOLVED" != "$EXPECTED" ]; then
  echo "FAIL: settings table documents a default baseUrl of $EXPECTED but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "✓ Provider default baseUrl resolves to $EXPECTED"
{{< /doc-test >}}
