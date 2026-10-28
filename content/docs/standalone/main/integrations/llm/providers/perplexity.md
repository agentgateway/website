---
title: Perplexity
weight: 20
icon: /integrations/providers/bw/perplexity.svg
description: Route agentgateway LLM traffic to models available through Perplexity.
---

Configure Perplexity as an LLM provider in agentgateway.

> [!NOTE]
> Send requests to `/v1/responses` or `/v1/messages`. Messages requests are converted to the OpenAI Responses format, which is the only format that the `perplexity` provider sends to Perplexity. Requests to `/v1/chat/completions` fail. To send Chat Completions requests to Perplexity, use a [custom provider]({{< link-hextra path="/integrations/llm/providers/custom/" >}}) with the `completions` format and `baseUrl: https://api.perplexity.ai/v1`.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: perplexity
    params:
      apiKey: "$PERPLEXITY_API_KEY"
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `perplexity`. |
| `params.model` | Optional. If you set this field, this model is used for all requests. If you omit this field, the request must include the model to use. |
| `params.apiKey` | Your Perplexity API key. You can reference environment variables using the `$VAR_NAME` syntax. |
| `params.baseUrl` | Optional. Overrides the provider base URL. Default: `https://api.perplexity.ai/v1`. |

## Example request

After you run agentgateway with the Perplexity configuration, send an OpenAI Responses request to the `/v1/responses` endpoint:

```bash
curl -X POST http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "perplexity/sonar",
    "input": "Hello from Perplexity!"
  }'
```
