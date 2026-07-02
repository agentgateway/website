---
title: Messages
weight: 30
description: Send requests through agentgateway using the Anthropic Messages API.
test: skip
---

The Anthropic Messages API (`/v1/messages`) is the native interface for Anthropic Claude models.

## About

The [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) is the primary endpoint for Claude models.
Agentgateway proxies these requests to your configured providers while providing token usage tracking, observability metrics, and policy enforcement.

When using the Anthropic provider, Agentgateway automatically handles additional requirements, such as the `x-api-key` and `anthropic-version` headers that the Anthropic API requires.

The related [`/v1/messages/count_tokens`]({{< link-hextra path="/llm/api-types/token-count/" >}}) endpoint estimates token usage before sending a request and is handled by the `anthropicTokenCount` route type.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/messages` requests to the `messages` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```

To configure the route type explicitly, use the `binds/listeners/routes` format and set the `messages` route type in the `policies.ai.routes` map. To also support token counting, map `/v1/messages/count_tokens` to the `anthropicTokenCount` route type.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 4000
  listeners:
  - routes:
    - backends:
      - ai:
          name: anthropic
          provider:
            anthropic: {}
      policies:
        ai:
          routes:
            "/v1/messages": "messages"
            "/v1/messages/count_tokens": "anthropicTokenCount"
        backendAuth:
          key: "$ANTHROPIC_API_KEY"
```

{{< callout type="info" >}}
For detailed information about model routing and configuration modes, see [Model routing and aliases]({{< link-hextra path="/llm/about/" >}}).
{{< /callout >}}

## Using the API

Send a request to the `/v1/messages` endpoint. The request is forwarded to the Anthropic API and the response is returned to the client.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl -X POST http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-6",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations](/docs/standalone/latest/integrations/llm-clients/).

{{% /tab %}}
{{< /tabs >}}

For Anthropic-specific features such as token counting, extended thinking, and structured outputs, see the [Anthropic provider]({{< link-hextra path="/llm/providers/anthropic/" >}}) guide.
