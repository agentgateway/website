---
title: Backends
weight: 13
description: 
prev: /docs/configuration/listeners
---

Agentgateway {{< gloss "Backend" >}}backends{{< /gloss >}} control where traffic is routed to.
Agentgateway supports a variety of backends, such as simple hostnames and IP addresses, {{< gloss "Provider" >}}LLM providers{{< /gloss >}}, and MCP servers.

## Static Hosts

The simplest form of backend is a static hostname or IP address. For example:

```yaml
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
See the [MCP connectivity guide](/docs/mcp/) for more information.

```yaml
backends:
- mcp:
    targets:
    - name: stdio-server
      {{< gloss "STDIO (Standard Input/Output)" >}}stdio{{< /gloss >}}:
        cmd: npx
        args: ["@modelcontextprotocol/server-everything"]
    - name: http-server
      mcp:
        host: https://example.com/mcp
```

## LLM Providers

Agentgateway natively supports connecting to LLM providers, such as OpenAI and Anthropic.
Below shows a simple example, connecting to OpenAI.
See the [LLM consumption guide](/docs/llm/) for more information.

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
