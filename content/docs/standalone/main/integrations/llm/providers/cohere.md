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

1. Set your API key in the `COHERE_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export COHERE_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Cohere**.
5. Keep the default `cohere/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `COHERE_API_KEY`.
7. For **Outgoing model**, keep **Strip cohere/**. This option removes the `cohere/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-cohere-prefix.png" srcDark="img/ui-llm-add-model-cohere-prefix-dark.png" alt="Add model drawer with Cohere selected as the provider, cohere/* as the incoming model match, and COHERE_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "cohere/*"
    provider: cohere
    params:
      apiKey: "$COHERE_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("cohere/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `cohere/*` pattern matches any model name that starts with `cohere/`. |
| `provider` | The LLM provider, set to `cohere`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Cohere API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.cohere.ai`. |
| `transformation.model` | Removes the `cohere/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="cohere" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "cohere/*"
    provider: cohere
    params:
      apiKey: "$COHERE_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("cohere/")
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cohere/command-r-plus",
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
