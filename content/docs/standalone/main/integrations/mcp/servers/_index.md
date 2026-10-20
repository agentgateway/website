---
title: Servers
weight: 10
description: Connect agentgateway proxies to MCP tool servers via various transports
test: skip
---

Connect agentgateway to an MCP tool server. 

## Why put agentgateway in front of an MCP server?

To inspect the targets in the top-level `mcp` section from the terminal, use `agctl standalone get mcp.target -o yaml`. A target that you nest inside a route is part of the `traffic.route` resource instead. To add or remove targets from the command line, see [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/#agctl" >}}).

| Without agentgateway | With agentgateway |
|----------------------|-------------------|
| Direct client-to-server connections | Centralized gateway for all MCP traffic |
| No authentication layer | External authentication (OAuth2, Tailscale, etc.) |
| No observability | Full OpenTelemetry tracing and metrics |
| No rate limiting | Per-client and per-tool rate limits |
| No access control | Fine-grained authorization policies |
| Clients must handle each transport | Unified endpoint for all transports |
