---
title: Baseten
weight: 20
icon: /integrations/providers/bw/baseten.svg
description: Route agentgateway LLM traffic to models hosted on Baseten.
test:
  baseten:
  - file: ${versionRoot}/integrations/llm/providers/baseten.md
    path: baseten
---

Configure Baseten as an LLM provider in agentgateway.

{{< doc-test paths="baseten" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Configuration": the example config is accepted by agentgateway
#     (--validate-only), so `provider: baseten` is a recognized provider and the
#     `name` / `params.apiKey` fields are correct.
#   * The `params.baseUrl` row of the settings table: with the config loaded,
#     agentgateway resolves this provider's upstream to the documented default
#     (https://inference.baseten.co/v1), so the table cannot drift from the product without
#     this test failing.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * "Example request" - external dependency; sending the curl request needs a
#     real Baseten API key and bills a live completion, so the test uses a
#     placeholder key and asserts on resolved config instead.
#   * `params.model` - display-only table row; the example config omits it, so
#     there is nothing on this page to run.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only and
# the config dump still resolve env vars, so a placeholder is enough here.
export BASETEN_API_KEY="${BASETEN_API_KEY:-test}"
{{< /doc-test >}}

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `BASETEN_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export BASETEN_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Baseten**.
5. Keep the default `baseten/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `BASETEN_API_KEY`.
7. For **Outgoing model**, keep **Strip baseten/**. This option removes the `baseten/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-baseten-prefix.png" srcDark="img/ui-llm-add-model-baseten-prefix-dark.png" alt="Add model drawer with Baseten selected as the provider, baseten/* as the incoming model match, and BASETEN_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "baseten/*"
    provider: baseten
    params:
      apiKey: "$BASETEN_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("baseten/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `baseten/*` pattern matches any model name that starts with `baseten/`. |
| `provider` | The LLM provider, set to `baseten`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Baseten API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://inference.baseten.co/v1`. |
| `transformation.model` | Removes the `baseten/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="baseten" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "baseten/*"
    provider: baseten
    params:
      apiKey: "$BASETEN_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("baseten/")
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint by replacing `<your-baseten-model-id>` with your Baseten model or deployment ID:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "baseten/<your-baseten-model-id>",
    "messages": [{"role": "user", "content": "Hello from Baseten!"}]
  }'
```

{{< doc-test paths="baseten" >}}
# Confirm the default `params.baseUrl` documented in the settings table is what
# agentgateway actually resolves. The admin config dump reports the upstream host
# and path prefix separately, so they are recombined before comparing.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

EXPECTED="https://inference.baseten.co/v1"
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
