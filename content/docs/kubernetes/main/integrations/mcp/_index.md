---
title: MCP
weight: 10
description: Connect agentgateway to MCP servers and the clients that consume them.
test: skip
---

MCP streams can stay open while no tool calls or notifications are in flight. Some networks close idle connections at a load balancer, API gateway, or network address translation (NAT) device. To keep those streams open, configure the MCP backend to send Server-Sent Events (SSE) keep-alive comments.

Agentgateway forwards the configured `sseKeepAlive` interval to the data plane. The data plane sends SSE comment frames that MCP clients ignore but network intermediaries count as traffic.
