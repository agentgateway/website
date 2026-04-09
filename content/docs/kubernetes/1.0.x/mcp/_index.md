---
title: MCP connectivity
weight: 40
test: skip
---

Route to Model Context Protocol (MCP) servers through  {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

{{< cards >}}
  {{< card link="about" title="About" subtitle="MCP overview and architecture" >}}
  {{< card link="static-mcp" title="Static MCP" subtitle="Fixed MCP server routing" >}}
  {{< card link="dynamic-mcp" title="Dynamic MCP" subtitle="Runtime MCP server discovery" >}}
  {{< card link="dynamic-mcp" title="Virtual MCP" subtitle="Aggregate tools from multiple servers" >}}
  {{< card link="https" title="Connect via HTTPS" subtitle="Secure MCP connections" >}}
  {{< card link="auth" title="MCP auth" subtitle="Authenticate MCP connections" >}}
  {{< card link="mcp-access" title="JWT auth for services" subtitle="Service-level JWT authentication" >}}
  {{< card link="tool-access" title="Tool access" subtitle="Control tool-level permissions" >}}
  {{< card link="rate-limit" title="Rate limiting for MCP" subtitle="Tool call budgets" >}}
{{< /cards >}}