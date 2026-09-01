---
title: Connect to MCP servers
weight: 20
description: Connect agentgateway proxies to MCP tool servers via various transports
test: skip
---

Connect agentgateway to an MCP tool server. 

## Why put agentgateway in front of an MCP server?

| Without agentgateway | With agentgateway |
|----------------------|-------------------|
| Direct client-to-server connections | Centralized gateway for all MCP traffic |
| No authentication layer | External authentication (OAuth2, Tailscale, etc.) |
| No observability | Full OpenTelemetry tracing and metrics |
| No rate limiting | Per-client and per-tool rate limits |
| No access control | Fine-grained authorization policies |
| Clients must handle each transport | Unified endpoint for all transports |
