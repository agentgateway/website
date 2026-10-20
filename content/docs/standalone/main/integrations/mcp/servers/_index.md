---
title: Servers
weight: 10
description: Connect agentgateway proxies to MCP tool servers via various transports
test: skip
---

Connect agentgateway to an MCP tool server. 

## Why put agentgateway in front of an MCP server?

For terminal-based configuration, the [MCP quickstart]({{< link-hextra path="/documentation/quickstart/mcp/#step-3-enable-mcp" >}}) includes an `agctl standalone apply` example. Use `agctl standalone get mcp.target -o yaml` to inspect targets in the top-level `mcp` section. Targets nested inside a route are part of the `traffic.route` resource instead; see [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/" >}}).

| Without agentgateway | With agentgateway |
|----------------------|-------------------|
| Direct client-to-server connections | Centralized gateway for all MCP traffic |
| No authentication layer | External authentication (OAuth2, Tailscale, etc.) |
| No observability | Full OpenTelemetry tracing and metrics |
| No rate limiting | Per-client and per-tool rate limits |
| No access control | Fine-grained authorization policies |
| Clients must handle each transport | Unified endpoint for all transports |
