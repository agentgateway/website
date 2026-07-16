---
title: DeepInfra
weight: 20
icon: /integrations/providers/bw/deepinfra.svg
description: Route agentgateway LLM traffic to models hosted on DeepInfra.
---

Configure DeepInfra as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: deepinfra
    params:
      apiKey: "$DEEPINFRA_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `deepinfra`. |
| `params.model` | Optional. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | Your DeepInfra API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.deepinfra.com/v1/openai`. |

## Example request

After running agentgateway with the configuration from the previous section, you can send an OpenAI-compatible request to the `v1/chat/completions` endpoint:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "messages": [{"role": "user", "content": "Hello from DeepInfra!"}]
  }'
```
