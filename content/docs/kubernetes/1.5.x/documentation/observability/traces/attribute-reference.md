---
title: Span attribute reference
description: Reference for the default HTTP, conditional, generative AI, and MCP span attributes emitted by agentgateway, including policy call child spans.
weight: 20
test: skip
---

The following default attributes are included in each span. Protocol-specific attributes, such as `gen_ai.*` and `mcp.*`, only appear when that type of traffic is processed. You can [add custom attributes]({{< link path="/documentation/observability/traces/setup/#add-attributes" >}}) to your spans or [remove default ones]({{< link path="/documentation/observability/traces/setup/#remove-attributes" >}}).

{{< reuse "agw-docs/pages/observability/traces/attribute-reference.md" >}}
