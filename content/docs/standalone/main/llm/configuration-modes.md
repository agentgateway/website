---
title: Routing-based configuration for LLMs
weight: 100
description: Use traditional HTTP routing configuration for advanced use cases like path-based routing and non-LLM backends
---

Agentgateway offers two ways to configure LLM providers, each optimized for different use cases.

- [LLM-based configuration](#simplified-llm-configuration)
- [Routing-based configuration](#routing-based-configuration)

Both modes serve traffic on a [gateway]({{< link-hextra path="/configuration/gateways/" >}}), which defines the port that agentgateway listens on. The difference is how you describe what the gateway serves: the `llm` section describes models, and the `routes` section describes HTTP routes and backends.

## Choosing between the two

Use this decision tree to choose the right configuration mode.

> [!NOTE]
> You can use both configuration modes in the same file if needed, but typically one mode is sufficient for most use cases.

| Question | Answer | Recommendation |
|----------|--------|----------------|
| Are you only routing to LLM providers? | Yes | LLM-based configuration |
| Do you need model-based routing with header matching? | Yes | LLM-based configuration |
| Do you need custom, path-based routing (e.g., `/openai`, `/anthropic`)? | Yes | Routing-based configuration |
| Do you need to route to non-LLM backends? | Yes | Routing-based configuration |
| Do you need to serve different content on different ports? | Yes | Routing-based configuration |

## Simplified LLM configuration

The simplified `llm` configuration is designed specifically for LLM use cases. Use this approach when your primary goal is to route traffic to LLM providers.

In general, the docs use the simplified LLM configuration.

### About

When to use the simplified LLM configuration:

- You are building an LLM gateway or AI proxy.
- You need to route requests to one or more LLM providers.
- You want model-based routing with header matching.
- You need LLM-specific policies like JWT authentication or authorization.

The benefits of this approach are:

- **Concise**: Less configuration needed for common LLM scenarios.
- **Model-centric**: Focus on LLM models rather than HTTP routing.
- **LLM policies**: Built-in support for JWT auth and authorization rules.
- **Easy multi-provider**: Simple syntax for routing to multiple providers.

### Example

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

### Advanced example with policies and matching

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  policies:
    jwtAuth:
      issuer: agentgateway.dev
      audiences: [api.example.com]
      jwks:
        file: ./public-key.json
    authorization:
      rules:
      - 'jwt.email.endsWith("@example.com")'
  models:
  - name: claude-haiku
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
    matches:
    - headers:
      - name: x-org
        value:
          exact: engineering
  - name: gpt-4
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
```

### LLM listener ports and TLS

To set the port and TLS settings for LLM traffic, define a gateway and attach the `llm` section to it. When you omit the `gateways` field, the `llm` section attaches to the gateway named `default`. The `mcp` and `ui` sections attach the same way, so all three can share one port.

When your configuration file defines no gateway at all, such as the earlier basic example, the implied `default` gateway serves LLM traffic on port `4000` and MCP traffic on port `3000`. Requests use the OpenAI-compatible paths, such as `http://localhost:4000/v1/chat/completions`.

> [!NOTE]
> The `llm.port`, `llm.tls`, and `mcp.port` fields are deprecated in favor of gateways. They still work, and setting them overrides these defaults.

Use the gateway's `tls` field to serve LLM traffic over TLS.
- Most deployments only need `cert` and `key`.
- Use `root` for a custom trust bundle or mTLS.
- Other advanced TLS tuning options include `cipherSuites`, `minTLSVersion`, `maxTLSVersion`, and `keyExchangeGroups`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 8443
    tls:
      cert: /etc/agentgateway/tls/tls.crt
      key: /etc/agentgateway/tls/tls.key
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
mcp:
  targets:
  - name: tools
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```

For more MCP listener context, see [MCP overview]({{< link-hextra path="/mcp/" >}}).

## Routing-based configuration

The `gateways` and `routes` configuration provides full control over HTTP routing. Use this approach when you need advanced HTTP routing capabilities or non-LLM backends.

### About

When to use the routing-based configuration:

- You need complex HTTP routing based on paths, methods, or query parameters.
- You are routing to non-LLM backends alongside LLM providers.
- You need fine-grained control over listeners and ports.
- You require advanced HTTP policies like CORS, rate limiting, or transformations.

The benefits of this approach are:
- **Flexible routing**: Full HTTP routing capabilities with path, method, query, and header matching.
- **Mixed backends**: Route to both LLM and non-LLM backends in the same configuration.
- **HTTP policies**: Access to all HTTP-level policies like CORS, rate limiting, and transformations.
- **Multiple gateways**: Configure different ports and protocols, and serve the same route on more than one of them.

### Example

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

gateways:
  default:
    port: 3000
    protocol: HTTP
routes:
- backends:
  - ai:
      name: openai
      provider:
        openAI:
          model: gpt-3.5-turbo
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
```

### Advanced example with HTTP routing

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

gateways:
  default:
    port: 3000
    protocol: HTTP
routes:
# Route OpenAI requests
- name: openai-route
  matches:
  - path:
      pathPrefix: /openai
  backends:
  - ai:
      name: openai
      provider:
        openAI:
          model: gpt-4o
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
# Route Anthropic requests
- name: anthropic-route
  matches:
  - path:
      pathPrefix: /anthropic
  backends:
  - ai:
      name: anthropic
      provider:
        anthropic:
          model: claude-3-5-haiku-20241022
  policies:
    backendAuth:
      key: "$ANTHROPIC_API_KEY"
# Non-LLM backend
- name: api-route
  matches:
  - path:
      pathPrefix: /api
  backends:
  - host: api.example.com:443
```
