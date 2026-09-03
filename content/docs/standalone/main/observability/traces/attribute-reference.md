---
title: Span attribute reference
weight: 20
description: Reference for the default HTTP, conditional, generative AI, and MCP span attributes emitted by agentgateway, including policy call child spans.
test: skip
aliases:
  - /docs/standalone/main/reference/observability/traces/
---

The following default attributes are included in each span. Protocol-specific attributes, such as `gen_ai.*` and `mcp.*`, only appear when that type of traffic is processed. You can [add custom attributes]({{< link-hextra path="/observability/traces/setup/#add-attributes" >}}) to your spans or [remove default ones]({{< link-hextra path="/observability/traces/setup/#remove-attributes" >}}).

{{< reuse "agw-docs/pages/observability/traces/attribute-reference.md" >}}
