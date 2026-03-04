---
title: Configuration modes
weight: 2
description: Understand when to use simplified LLM configuration vs traditional HTTP routing configuration
---

Agentgateway offers two ways to configure LLM providers, each optimized for different use cases.

## Simplified LLM configuration

The simplified `llm:` configuration is designed specifically for LLM use cases. Use this approach when your primary goal is to route traffic to LLM providers.

### When to use

- You are building an LLM gateway or AI proxy.
- You need to route requests to one or more LLM providers.
- You want model-based routing with header matching.
- You need LLM-specific policies like JWT authentication or authorization.

### Example

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gpt-3.5-turbo
    provider: openai
    params:
      model: gpt-3.5-turbo
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
    provider: openai
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
```

### Benefits

- **Concise**: Less configuration needed for common LLM scenarios.
- **Model-centric**: Focus on LLM models rather than HTTP routing.
- **LLM policies**: Built-in support for JWT auth and authorization rules.
- **Easy multi-provider**: Simple syntax for routing to multiple providers.

## Traditional HTTP routing configuration

The traditional `binds/listeners/routes` configuration provides full control over HTTP routing. Use this approach when you need advanced HTTP routing capabilities or non-LLM backends.

### When to use

- You need complex HTTP routing based on paths, methods, or query parameters.
- You are routing to non-LLM backends alongside LLM providers.
- You need fine-grained control over listeners and ports.
- You require advanced HTTP policies like CORS, rate limiting, or transformations.

### Example

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

binds:
- port: 3000
  listeners:
  - protocol: HTTP
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

binds:
- port: 3000
  listeners:
  - protocol: HTTP
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
      - http:
          host: api.example.com:443
```

### Benefits

- **Flexible routing**: Full HTTP routing capabilities with path, method, query, and header matching.
- **Mixed backends**: Route to both LLM and non-LLM backends in the same configuration.
- **HTTP policies**: Access to all HTTP-level policies like CORS, rate limiting, and transformations.
- **Multiple listeners**: Configure different ports and protocols.

## Choosing between the two

Use this decision tree to choose the right configuration mode.

| Question | Answer | Recommendation |
|----------|--------|----------------|
| Are you only routing to LLM providers? | Yes | Use simplified `llm:` configuration |
| Do you need model-based routing with header matching? | Yes | Use simplified `llm:` configuration |
| Do you need path-based routing (e.g., `/openai`, `/anthropic`)? | Yes | Use traditional `binds/listeners/routes` |
| Do you need to route to non-LLM backends? | Yes | Use traditional `binds/listeners/routes` |
| Do you need multiple listeners on different ports? | Yes | Use traditional `binds/listeners/routes` |
| Do you need HTTP policies like CORS or rate limiting? | Yes | Use traditional `binds/listeners/routes` |

{{< callout type="info" >}}
You can use both configuration modes in the same file if needed, but typically one mode is sufficient for most use cases.
{{< /callout >}}

## Next steps

{{< cards >}}
  {{< card link="../providers/" title="LLM Providers" subtitle="Configure specific LLM providers like OpenAI, Anthropic, and Bedrock" >}}
  {{< card link="../api-keys/" title="API Keys" subtitle="Manage API keys for LLM providers" >}}
  {{< card link="../../configuration/overview/" title="Configuration Overview" subtitle="Learn more about agentgateway configuration" >}}
{{< /cards >}}
