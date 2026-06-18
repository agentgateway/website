---
title: OpenAI
weight: 10
description: Configuration and setup for OpenAI LLM provider
---

Configure OpenAI as an LLM provider in agentgateway.

## Configuration

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `openai` for OpenAI models. |
| `params.model` | The specific OpenAI model to use. If set, this model is used for all requests. If not set, the request must include the model to use. |
| `params.apiKey` | The OpenAI API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

{{< callout type="info" >}}
For advanced routing scenarios that require path-based routing or custom endpoints, use the traditional `binds/listeners/routes` configuration format. See the [Routing-based configuration guide]({{< link-hextra path="/llm/configuration-modes/" >}}) for more information.
{{< /callout >}}

{{< callout type="info" >}}
To connect Codex to agentgateway, see the [Codex integration page]({{< link-hextra path="/integrations/llm-clients/codex" >}}).
{{< /callout >}}