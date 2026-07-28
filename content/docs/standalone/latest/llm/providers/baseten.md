---
title: Baseten
weight: 20
icon: /integrations/providers/bw/baseten.svg
description: Route agentgateway LLM traffic to models hosted on Baseten.
---

Configure Baseten as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: baseten
    params:
      apiKey: "$BASETEN_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `baseten`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Baseten API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://inference.baseten.co/v1`. |

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint by replacing `<your-baseten-model-id>` with your Baseten model or deployment ID:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<your-baseten-model-id>",
    "messages": [{"role": "user", "content": "Hello from Baseten!"}]
  }'
```
