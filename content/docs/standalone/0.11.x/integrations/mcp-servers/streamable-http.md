---
title: Streamable HTTP Transport
weight: 30
description: Connect Agent Gateway to MCP servers via HTTP with streaming
---

Streamable HTTP transport connects Agent Gateway to remote MCP servers over HTTP with streaming support for real-time responses.

## Overview

Streamable HTTP transport is ideal when:
- MCP servers run as standalone HTTP services
- You need real-time streaming of responses
- The server is accessible over the network
- You want stateful sessions with the MCP server

## Quick start

```bash
# Start an MCP server with streamable HTTP
PORT=3005 npx -y @modelcontextprotocol/server-everything streamableHttp

# Create config.yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
          - name: mcp
            mcp:
              host: http://localhost:3005/mcp/
EOF

# Run Agent Gateway
agentgateway -f config.yaml
```

## Configuration

Configure a streamable HTTP MCP backend:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
          - name: remote-mcp
            mcp:
              host: http://mcp-server:8080/mcp/
```

## Key configuration

| Setting | Description |
|---------|-------------|
| `mcp.host` | The HTTP URL of the MCP server endpoint |
| `cors.exposeHeaders` | Must include `Mcp-Session-Id` for session management |

## Example: Multiple MCP servers

Aggregate multiple remote MCP servers:

```yaml
backends:
- mcp:
    targets:
    - name: server-a
      mcp:
        host: http://mcp-server-a:8080/mcp/
    - name: server-b
      mcp:
        host: http://mcp-server-b:8080/mcp/
```

## Why use Agent Gateway?

| Direct HTTP Connection | With Agent Gateway |
|-----------------------|-------------------|
| Client manages connections | Gateway handles reconnection and buffering |
| No authentication | OAuth2, API keys, or custom auth |
| No access control | Tool-level authorization |
| Single server per client | Multiple servers aggregated |
| No metrics | Full observability with OpenTelemetry |
| Manual session handling | Automatic session management |

## Verify access

1. Open the [Agent Gateway UI](http://localhost:15000/ui/) to view your configuration
2. Go to [Playground](http://localhost:15000/ui/playground/) to test tools
3. Click **Connect** to retrieve available tools from all configured servers
4. Select a tool and click **Run Tool** to test

## Learn more

- [MCP Connectivity Guide]({{< link-hextra path="/mcp/" >}})
- [Streamable HTTP Reference]({{< link-hextra path="/mcp/connect/http/" >}})
- [MCP Authentication]({{< link-hextra path="/mcp/mcp-authn/" >}})
