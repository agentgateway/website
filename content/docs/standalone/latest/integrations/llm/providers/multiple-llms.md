---
title: Multiple LLM providers
weight: 30
description: Define reusable LLM provider configurations once and reference them across multiple model definitions to avoid duplicating connection and authentication parameters.
---

## Reusable provider configuration

Reuse provider configuration to avoid duplicating connection and authentication parameters across multiple model definitions. Define named provider defaults once in `llm.providers[]` and reference them from multiple `llm.models[]` entries with `provider.reference`. You can set up the shared provider in the UI or in your configuration file.

{{< reuse "agw-docs/snippets/model-exposure-patterns-tip.md" >}}

{{< tabs >}}
{{% tab name="UI" %}}
To create the shared provider and the two models in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same configuration as the **Config file** tab.

1. Set your API key in the `OPENAI_API_KEY` environment variable. The UI checks that the variable exists when you save.

   ```sh
   export OPENAI_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Create the shared provider.
   1. Open **LLM** > **Providers**, such as [http://localhost:15000/ui/llm/providers](http://localhost:15000/ui/llm/providers), and click **Add provider**.
   2. Enter `openai-prod` for the **Provider name**.
   3. Keep **OpenAI** as the **Provider**.
   4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.

      {{< reuse-image src="img/ui-llm-add-provider.png" srcDark="img/ui-llm-add-provider-dark.png" alt="Add provider drawer with openai-prod as the provider name, OpenAI selected as the provider, and OPENAI_API_KEY as the environment variable for the provider API key" >}}

   5. Click **Save provider**.
4. Create the `fast` model.
   1. Open **LLM** > **Models**, and click **Add model**.
   2. From the **Provider** dropdown, select **openai-prod**, which is marked **configured**.
   3. In the **Incoming model match** field, replace the default `openai-prod/*` with `fast`.
   4. For the **Outgoing model**, select **Explicit**, and enter `gpt-4o-mini`.
   5. Click **Save model**.
5. Repeat the previous step for the `smart` model, with the outgoing model `gpt-4o`.

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

In this example, `smart` inherits the upstream API key from `llm.providers[]` and only changes the model name.

Named providers can hold shared upstream settings you want to reuse, such as authentication, host overrides, path overrides, or other model defaults.
Keep the shared values on `llm.providers[]` and only set per-model differences on `llm.models[]`.
