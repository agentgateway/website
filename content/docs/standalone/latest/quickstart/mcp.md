---
title: MCP servers
weight: 12
description: Connect to an MCP server and try tools in the agentgateway playground.
# The 1.3 steps add the MCP server through the UI (not scriptable); a hidden {{< doc-test >}}
# block in the shared snippet reproduces the equivalent config + backends so this stays tested.
test:
  mcp-playground:
  - file: content/docs/standalone/latest/quickstart/mcp.md
    path: mcp
---

{{< reuse "agw-docs/standalone/quickstart/mcp.md" >}}
