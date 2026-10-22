---
title: OpenAI
weight: 10
icon: /integrations/providers/bw/openai.svg
description: Route agentgateway LLM traffic to OpenAI's GPT models.
test:
  openai:
  - file: ${versionRoot}/integrations/llm/providers/openai.md
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

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `OPENAI_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export OPENAI_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **OpenAI**.
5. Keep the default `openai/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.
7. For **Outgoing model**, keep **Strip openai/**. This option removes the `openai/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-openai-prefix.png" srcDark="img/ui-llm-add-model-openai-prefix-dark.png" alt="Add model drawer with OpenAI selected as the provider, openai/* as the incoming model match, and OPENAI_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

The UI writes the provider as `openai` instead of `openAI`. Agentgateway accepts both values.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "openai/*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("openai/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `openai/*` pattern matches any model name that starts with `openai/`. |
| `provider` | The LLM provider, set to `openAI` for OpenAI models. |
| `params.model` | The specific OpenAI model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The OpenAI API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |
| `transformation.model` | Removes the `openai/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="openai" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "openai/*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("openai/")
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

> [!NOTE]
> For advanced routing scenarios that require path-based routing or custom endpoints, use the `gateways` and `routes` configuration format. See the [Routing-based configuration guide]({{< link-hextra path="/documentation/llm/configuration-modes/" >}}) for more information.

> [!NOTE]
> To connect Codex to agentgateway, see the [Codex integration page]({{< link-hextra path="/integrations/llm/clients/codex" >}}).

{{< doc-test paths="openai" >}}
# Confirm the config serves the model named in the example and resolves it to
# this provider. First-class providers use built-in upstream defaults, so the
# config dump reports the provider discriminant rather than a host override.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

# The default `llm.discovery: catalog` expands `openai/*` into prefixed catalog
# model IDs, so check for a non-empty list rather than a literal `openai/*`.
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
if [ "$PROVIDER" != "openAI" ]; then
  echo "FAIL: expected provider openAI but agentgateway resolved $PROVIDER"
  exit 1
fi
echo "✓ The prefixed model is served and resolves to the openAI provider"
{{< /doc-test >}}
