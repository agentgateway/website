---
title: Cohere
weight: 20
icon: /integrations/providers/bw/cohere.svg
description: Route agentgateway LLM traffic to Cohere's models.
---

Configure Cohere as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: cohere
    params:
      apiKey: "$COHERE_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `cohere`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your Cohere API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.cohere.ai`. |

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "command-r-plus",
    "messages": [{"role": "user", "content": "Hello from Cohere!"}]
  }'
```
