---
title: Token count
weight: 60
description: Count tokens through agentgateway using the Anthropic Messages token-count API.
test: skip
---

The Anthropic token-count API (`/v1/messages/count_tokens`) estimates the number of input tokens in an Anthropic Messages request before sending it to a model.

## About

Agentgateway supports the Anthropic Messages token-count endpoint with the `anthropicTokenCount` route type. Use this endpoint when clients need to estimate request size before calling `/v1/messages`, such as to enforce budgets, avoid context-window limits, or show usage estimates.

## Route type configuration

In the simplified `llm` configuration, agentgateway automatically maps `/v1/messages/count_tokens` requests to the `anthropicTokenCount` route type, so no explicit route configuration is required.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```

To configure the route type explicitly, use the `binds/listeners/routes` format and set the `anthropicTokenCount` route type in the `policies.ai.routes` map. Most configurations also map `/v1/messages` to the `messages` route type for the actual model request.

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

Send a request to the `/v1/messages/count_tokens` endpoint with the same message shape that you would send to `/v1/messages`.

{{< tabs >}}
{{% tab name="Curl" %}}

```shell
curl 'http://localhost:4000/v1/messages/count_tokens' \
--header 'Content-Type: application/json' \
--data '{
  "model": "claude-opus-4-6",
  "messages": [
    {
      "role": "user",
      "content": "How many tokens are in this request?"
    }
  ]
}'
```

{{% /tab %}}
{{% tab name="Other" %}}

[View other LLM client integrations](/docs/standalone/main/integrations/llm-clients/).

{{% /tab %}}
{{< /tabs >}}

For Anthropic-specific features such as Messages, token counting, extended thinking, and structured outputs, see the [Anthropic provider]({{< link-hextra path="/llm/providers/anthropic/" >}}) guide.
