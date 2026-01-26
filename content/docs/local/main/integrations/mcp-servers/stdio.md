---
title: stdio Transport
weight: 10
description: Connect Agent Gateway to local process-based MCP servers
---

The stdio transport connects Agent Gateway to MCP servers that run as local processes, communicating via standard input/output.

## Overview

stdio transport is ideal when:
- MCP servers run as local command-line tools
- You want to manage MCP server lifecycle with Agent Gateway
- The server is distributed as an npm package or binary

## Quick start

```bash
# Download the stdio MCP configuration
curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml -o config.yaml

# Run Agent Gateway
agentgateway -f config.yaml
```

## Configuration

Configure an stdio MCP backend in your `config.yaml`:

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins:
            - "*"
          allowHeaders:
            - "*"
          exposeHeaders:
            - "Mcp-Session-Id"
      backends:
      - mcp:
          targets:
          - name: my-mcp-server
            stdio:
              cmd: npx
              args:
                - "-y"
                - "@modelcontextprotocol/server-everything"
```

## Example: MCP test server

The MCP test server (`@modelcontextprotocol/server-everything`) is useful for testing:

```yaml
backends:
- mcp:
    targets:
    - name: test-server
      stdio:
        cmd: npx
        args:
          - "-y"
          - "@modelcontextprotocol/server-everything"
```

## Example: Filesystem MCP server

Expose local filesystem access via MCP:

```yaml
backends:
- mcp:
    targets:
    - name: filesystem
      stdio:
        cmd: npx
        args:
          - "-y"
          - "@modelcontextprotocol/server-filesystem"
          - "/path/to/allowed/directory"
```

## Why use Agent Gateway?

| Direct stdio | With Agent Gateway |
|--------------|-------------------|
| One client per server | Multiple clients share servers |
| No authentication | OAuth2, API keys, or custom auth |
| No access control | Tool-level authorization |
| Client manages process | Gateway manages lifecycle |
| No metrics | Full observability with OpenTelemetry |

## Verify access

1. Open the [Agent Gateway UI](http://localhost:15000/ui/) to view your configuration
2. Go to [Playground](http://localhost:15000/ui/playground/) to test tools
3. Click **Connect** to retrieve available tools
4. Select a tool and click **Run Tool** to test

## Learn more

- [MCP Connectivity Guide]({{< link-hextra path="/mcp/" >}})
- [stdio Configuration Reference]({{< link-hextra path="/mcp/connect/stdio/" >}})
- [MCP Authentication]({{< link-hextra path="/mcp/mcp-authn/" >}})
