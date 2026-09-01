---
title: MCP clients
weight: 10
description: Connect AI coding assistants and tools to agentgateway
test: skip
icon: extension
---

Configure popular AI coding assistants and tools to use agentgateway as their MCP server.

## Before you begin

{{< reuse "agw-docs/standalone/prereq-mcp-clients.md" >}}

> [!NOTE]
> **Multiplexed tool names**: If your agentgateway backend routes to more than one [Virtual MCP]({{< link-hextra path="/documentation/mcp/connect/virtual" >}}) target, agentgateway namespaces each tool and prompt name with its target name by default, for example `time_get_current_time`. When you add a second target, tools in your client's tool list might get new names because of this prefixing. Control it with the `prefixMode` field; see [Tool name prefixing]({{< link-hextra path="/documentation/mcp/connect/virtual#tool-name-prefixing" >}}) for the available modes.


