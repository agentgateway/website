---
title: MCP authorization
weight: 40
description: Control access to MCP tools and resources with CEL-based authorization rules
test: skip
---

MCP authorization controls which tools, prompts, and resources a client can reach. Rules are written as [CEL expressions]({{< link-hextra path="/reference/cel" >}}) that evaluate against specific MCP method invocations, such as `list_tools` and `call_tools`, rather than against an HTTP request.

If a tool or other resource is not allowed, agentgateway automatically filters it from `list` responses, so unauthorized clients never see it.

Combine authorization with [MCP authentication]({{< link-hextra path="/mcp/mcp-authn" >}}) to write rules against JWT claims, such as restricting a tool to a single user or to members of a role.

## Configure MCP authorization

The `mcpAuthorization` policy reference covers rule syntax, the CEL variables available at request time and in access logs, role-based access with JWT claims, and how to apply different rules to each target when you multiplex several MCP servers.

For the full reference and examples, see [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}).

## Related

{{< cards >}}
  {{< card path="/mcp/mcp-target-policies" title="MCP target policies" subtitle="Review the other policies that you can scope to an individual target." >}}
  {{< card path="/mcp/mcp-observability" title="MCP observability" subtitle="Log tool calls and their arguments after a request completes." >}}
  {{< card path="/reference/cel" title="CEL reference" subtitle="Look up the full list of supported variables and functions." >}}
  {{< card link="https://learncloudnative.com/blog/2026-08-14-7-practical-mcp-policies-agentgateway" title="7 practical MCP policies" subtitle="Community blog post with worked authorization, authentication, and guardrail recipes." icon="external-link" >}}
{{< /cards >}}
