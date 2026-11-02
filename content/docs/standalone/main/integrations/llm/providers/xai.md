---
title: xAI
weight: 20
icon: /integrations/providers/bw/xai.svg
description: Route agentgateway LLM traffic to xAI's Grok models.
---

Configure xAI (Grok) as an LLM provider in agentgateway.

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `XAI_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export XAI_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **xAI (Grok)**.
5. Keep the default `xai/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `XAI_API_KEY`.
7. For **Outgoing model**, keep **Strip xai/**. This option removes the `xai/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-xai-prefix.png" srcDark="img/ui-llm-add-model-xai-prefix-dark.png" alt="Add model drawer with xAI (Grok) selected as the provider, xai/* as the incoming model match, and XAI_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "xai/*"
    provider: xai
    params:
      apiKey: "$XAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("xai/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `xai/*` pattern matches any model name that starts with `xai/`. |
| `provider` | The LLM provider, set to `xai`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your xAI API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.x.ai/v1`. |
| `transformation.model` | Removes the `xai/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xai/grok-2-latest",
    "messages": [{"role": "user", "content": "Hello from Grok!"}]
  }'
```
