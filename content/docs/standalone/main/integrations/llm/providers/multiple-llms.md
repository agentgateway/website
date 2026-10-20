---
title: Multiple LLM providers
weight: 30
description: Define reusable LLM provider configurations once and reference them across multiple model definitions to avoid duplicating connection and authentication parameters.
test:
  multiple-llms:
  - file: ${versionRoot}/integrations/llm/providers/multiple-llms.md
    path: multiple-llms
---

{{< doc-test paths="multiple-llms" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Reusable provider configuration": the example config is accepted by
#     agentgateway (--validate-only), covering `llm.providers[].name`,
#     `llm.providers[].provider`, and `llm.models[].provider.reference`.
#   * A reference actually resolves at runtime: with the config loaded, both the
#     `fast` and `smart` models are served, which is only possible if each model
#     inherited its upstream provider (and API key) from the `openai-prod` entry
#     in `llm.providers[]`. A dangling reference fails to load.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a completion request routed through `fast` or `smart` reaches OpenAI -
#     external dependency; the test uses a placeholder API key and does not call
#     the provider.
#   * The other shared upstream settings the page mentions (host overrides, path
#     overrides, other model defaults) - display-only prose with no example
#     config on this page that sets them.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example config reads the API key from the environment. --validate-only and
# model listing still resolve env vars, so a placeholder is enough here.
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
{{< /doc-test >}}

## Reusable provider configuration

Reuse provider configuration to avoid duplicating connection and authentication parameters across multiple model definitions. Define named provider defaults once in `llm.providers[]` and reference them from multiple `llm.models[]` entries with `provider.reference`. You can set up the shared provider in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To create the shared provider and the two models in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same configuration as the **Config file** tab.

1. Start agentgateway with the `OPENAI_API_KEY` environment variable set. The UI checks that the variable exists when you save.
2. Create the shared provider.
   1. Open **LLM** > **Providers**, such as [http://localhost:15000/ui/llm/providers](http://localhost:15000/ui/llm/providers), and click **Add provider**.
   2. Enter `openai-prod` for the **Provider name**.
   3. Keep **OpenAI** as the **Provider**.
   4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.

      {{< reuse-image src="img/ui-llm-add-provider.png" srcDark="img/ui-llm-add-provider-dark.png" >}}

   5. Click **Save provider**.
3. Create the `fast` model.
   1. Open **LLM** > **Models**, and click **Add model**.
   2. From the **Provider** dropdown, select **openai-prod**, which is marked **configured**.
   3. In the **Incoming model match** field, replace the default `openai-prod/*` with `fast`.
   4. For the **Outgoing model**, select **Explicit**, and enter `gpt-4o-mini`.
   5. Click **Save model**.
4. Repeat the previous step for the `smart` model, with the outgoing model `gpt-4o`.

The **Used by** column on the **LLM** > **Providers** page lists the models that reference each provider. The UI writes the provider as `openai` instead of `openAI`. Agentgateway accepts both values.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
llm:
  providers:
  - name: openai-prod
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
  models:
  - name: fast
    provider:
      reference: openai-prod
    params:
      model: gpt-4o-mini
  - name: smart
    provider:
      reference: openai-prod
    params:
      model: gpt-4o
```
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="multiple-llms" >}}
cat <<'EOF' > config.yaml
llm:
  providers:
  - name: openai-prod
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"

  models:
  - name: fast
    provider:
      reference: openai-prod
    params:
      model: gpt-4o-mini
  - name: smart
    provider:
      reference: openai-prod
    params:
      model: gpt-4o
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

{{< doc-test paths="multiple-llms" >}}
# Simplified LLM mode with no explicit port serves on 4000.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="multiple-llms" >}}
YAMLTest -f - <<'EOF'
- name: Both models that reference the shared provider are served
  retries: 3
  http:
    url: "http://localhost:4000"
    path: /v1/models
    method: GET
    headers:
      accept-encoding: identity
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      # Filter expressions rather than $.data[*].id, because a wildcard path
      # resolves to a single match and the model order is not guaranteed.
      - path: "$.data[?(@.id=='fast')].id"
        comparator: equals
        value: fast
      - path: "$.data[?(@.id=='smart')].id"
        comparator: equals
        value: smart
EOF
{{< /doc-test >}}

In this example, `smart` inherits the upstream API key from `llm.providers[]` and only changes the model name.

Named providers can hold shared upstream settings you want to reuse, such as authentication, host overrides, path overrides, or other model defaults.
Keep the shared values on `llm.providers[]` and only set per-model differences on `llm.models[]`.
