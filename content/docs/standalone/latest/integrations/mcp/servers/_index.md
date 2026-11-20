---
title: Servers
weight: 10
description: Connect agentgateway proxies to MCP tool servers via various transports
---

Connect agentgateway to an MCP tool server.

To manage MCP targets on a running gateway from the command line, see [Manage config resources with agctl]({{< link-hextra path="/documentation/operations/config-resources/#agctl" >}}).

## Why put agentgateway in front of an MCP server?

| Without agentgateway | With agentgateway |
|----------------------|-------------------|
| Direct client-to-server connections | Centralized gateway for all MCP traffic |
| No authentication layer | External authentication (OAuth2, Tailscale, etc.) |
| No observability | Full OpenTelemetry tracing and metrics |
| No rate limiting | Per-client and per-tool rate limits |
| No access control | Fine-grained authorization policies |
| Clients must handle each transport | Unified endpoint for all transports |
