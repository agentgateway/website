---
title: MCP authorization
weight: 40
description: Control access to MCP tools and resources with CEL-based authorization rules
test: skip
---

MCP authorization controls which tools, prompts, and resources a client can reach, by using [CEL expressions]({{< link-hextra path="/reference/cel" >}}) that evaluate against MCP method invocations rather than against an HTTP request.

For the policy reference, including rule syntax, the CEL variables available at request time and in access logs, role-based access with JWT claims, and per-target rules, see [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}).

## Related

{{< cards >}}
  {{< card path="/mcp/mcp-authn" title="MCP authentication" subtitle="Validate tokens so that authorization rules can match on JWT claims." >}}
  {{< card path="/mcp/mcp-target-policies" title="MCP target policies" subtitle="Review the other policies that you can scope to an individual target." >}}
  {{< card path="/mcp/mcp-observability" title="MCP observability" subtitle="Log tool calls and their arguments after a request completes." >}}
  {{< card path="/reference/cel" title="CEL reference" subtitle="Look up the full list of supported variables and functions." >}}
  {{< card link="https://learncloudnative.com/blog/2026-08-14-7-practical-mcp-policies-agentgateway" title="7 practical MCP policies" subtitle="Community blog post with worked authorization, authentication, and guardrail recipes." icon="external-link" >}}
{{< /cards >}}
