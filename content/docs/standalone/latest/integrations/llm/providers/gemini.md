---
title: Gemini
weight: 15
icon: /integrations/providers/bw/gemini.svg
description: Route agentgateway LLM traffic to Google Gemini models.
---

Configure Google Gemini as an LLM provider in agentgateway.

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `GEMINI_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export GEMINI_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Gemini**.
5. Keep the default `gemini/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `GEMINI_API_KEY`.
7. For **Outgoing model**, keep **Strip gemini/**. This option removes the `gemini/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-gemini-prefix.png" srcDark="img/ui-llm-add-model-gemini-prefix-dark.png" alt="Add model drawer with Gemini selected as the provider, gemini/* as the incoming model match, and GEMINI_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "gemini/*"
    provider: gemini
    params:
      apiKey: "$GEMINI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("gemini/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `gemini/*` pattern matches any model name that starts with `gemini/`. |
| `provider` | The LLM provider, set to `gemini` for Google Gemini models. |
| `params.model` | The specific Gemini model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The Gemini API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |
| `transformation.model` | Removes the `gemini/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}
