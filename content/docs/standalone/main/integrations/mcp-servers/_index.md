---
title: MCP Servers
weight: 60
description: Connect agentgateway to MCP servers using various transports
---

Agentgateway supports connecting to MCP servers via multiple transport protocols. Choose the transport that best fits your deployment model.

## Transports

{{< cards >}}
  {{< card link="stdio" title="stdio" subtitle="Local process-based MCP servers" >}}
  {{< card link="sse" title="SSE" subtitle="Server-Sent Events transport" >}}
  {{< card link="streamable-http" title="Streamable HTTP" subtitle="HTTP with streaming support" >}}
{{< /cards >}}

## Why use agentgateway with MCP Servers?

| Without agentgateway | With agentgateway |
|----------------------|-------------------|
| Direct client-to-server connections | Centralized gateway for all MCP traffic |
| No authentication layer | External authentication (OAuth2, Tailscale, etc.) |
| No observability | Full OpenTelemetry tracing and metrics |
| No rate limiting | Per-client and per-tool rate limits |
| No access control | Fine-grained authorization policies |
| Clients must handle each transport | Unified endpoint for all transports |

## Learn more

- [MCP Connectivity Guide]({{< link-hextra path="/mcp/" >}})
- [MCP Authentication]({{< link-hextra path="/mcp/mcp-authn/" >}})
- [MCP Authorization]({{< link-hextra path="/mcp/mcp-authz/" >}})
