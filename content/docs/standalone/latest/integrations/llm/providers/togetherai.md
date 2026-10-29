---
title: Together AI
weight: 20
icon: /integrations/providers/bw/togetherai.svg
description: Route agentgateway LLM traffic to models hosted on Together AI.
---

Configure Together AI as an LLM provider in agentgateway.

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `TOGETHER_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export TOGETHER_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Together AI**.
5. Keep the default `togetherai/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `TOGETHER_API_KEY`.
7. For **Outgoing model**, keep **Strip togetherai/**. This option removes the `togetherai/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-togetherai-prefix.png" srcDark="img/ui-llm-add-model-togetherai-prefix-dark.png" alt="Add model drawer with Together AI selected as the provider, togetherai/* as the incoming model match, and TOGETHER_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "togetherai/*"
    provider: togetherai
    params:
      apiKey: "$TOGETHER_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("togetherai/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `togetherai/*` pattern matches any model name that starts with `togetherai/`. |
| `provider` | The LLM provider, set to `togetherai`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Together AI API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.together.xyz/v1`. |
| `transformation.model` | Removes the `togetherai/` prefix from the model name before the request is forwarded, so the provider receives its own model name. |
{{% /tab %}}
{{< /tabs >}}

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "togetherai/meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "messages": [{"role": "user", "content": "Hello from Together AI!"}]
  }'
```
