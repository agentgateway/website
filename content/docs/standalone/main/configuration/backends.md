---
title: Backends
weight: 13
description: 
prev: /configuration/listeners
---

Agentgateway {{< gloss "Backend" >}}backends{{< /gloss >}} control where traffic is routed to.
Agentgateway supports a variety of backends, such as simple hostnames and IP addresses, {{< gloss "Provider" >}}LLM providers{{< /gloss >}}, and MCP servers.

## Static Hosts

The simplest form of backend is a static hostname or IP address. For example:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes:
    - backends:
      - host: example.com:8080
        weight: 1
      - host: 127.0.0.1:80
        weight: 9
```

## MCP Servers

The MCP backend allows you to connect to an MCP server.
Below shows a simple example, exposing a local and remote MCP server.
See the [MCP connectivity guide]({{< link-hextra path="/mcp/" >}}) for more information.

```yaml
backends:
- mcp:
    targets:
    - name: stdio-server
      stdio:
        cmd: npx        
        args: ["@modelcontextprotocol/server-everything"]
    - name: http-server
      mcp:
        host: https://example.com/mcp
```

### Session routing

By default, MCP backends use stateful session routing, where the gateway tracks session IDs and routes subsequent requests to the same upstream. For upstreams that do not maintain server-side session state, you can set `statefulMode: Stateless`. In stateless mode, the gateway automatically wraps each request with an initialization sequence, so the upstream server processes every request independently.

```yaml
backends:
- mcp:
    statefulMode: Stateless
    targets:
    - name: openapi-server
      openapi:
        schema:
          url: https://petstore3.swagger.io/api/v3/openapi.json
```

## LLM Providers

Agentgateway natively supports connecting to LLM providers, such as OpenAI and Anthropic.
Below shows a simple example, connecting to OpenAI.
See the [LLM consumption guide]({{< link-hextra path="/llm/" >}}) for more information.

```yaml
backends:
- ai:
    provider:
      openAI:
        model: gpt-3.5-turbo
policies:
  backendAuth:
    key: "$OPENAI_API_KEY"
```
