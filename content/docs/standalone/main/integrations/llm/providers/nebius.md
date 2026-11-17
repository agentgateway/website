---
title: Nebius Token Factory
weight: 20
icon: /integrations/providers/bw/nebius.svg
description: Route agentgateway LLM traffic to models served by Nebius Token Factory.
---

Configure [Nebius Token Factory](https://tokenfactory.nebius.com/) as an LLM provider in agentgateway. The `nebius` provider sends Chat Completions and Embeddings requests to Nebius.

## Configuration

You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `NEBIUS_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export NEBIUS_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Nebius Token Factory**.
5. Keep the default `nebius/*` in the **Incoming model match** field.
6. For the **Provider API key**, select **Env var**, and enter `NEBIUS_API_KEY`.
7. For **Outgoing model**, keep **Strip nebius/**. This option removes the `nebius/` prefix before the request is forwarded. To send every request to one model instead, select **Explicit**, and enter the model name. This option sets `params.model`.
8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models:
  - name: "nebius/*"
    provider: nebius
    params:
      apiKey: "$NEBIUS_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("nebius/")
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. The `nebius/*` pattern matches any model name that starts with `nebius/`. |
| `provider` | The LLM provider, set to `nebius`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Nebius API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.tokenfactory.nebius.com/v1`. |
| `transformation.model` | Removes the `nebius/` prefix from the model name before the request is forwarded, so the provider receives its own model name. Nebius model names include the vendor, such as `openai/gpt-oss-120b`. |
{{% /tab %}}
{{< /tabs >}}

## Example requests

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nebius/openai/gpt-oss-120b",
    "messages": [{"role": "user", "content": "Hello from Nebius!"}]
  }'
```

To create embeddings, send a request with a Nebius embedding model to the `v1/embeddings` endpoint:

```bash
curl -X POST http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nebius/Qwen/Qwen3-Embedding-8B",
    "input": "Hello from Nebius!"
  }'
```
