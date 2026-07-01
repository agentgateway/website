---
title: Cost controls
weight: 60
description: Attribute, observe, enforce, and optimize LLM spend through agentgateway.
test: skip
---

Control LLM spend end to end, in four stages:

- **Attribute** — tie usage to teams and keys with [virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).
- **Observe** — compute the realized USD cost of every request with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}), and view it in metrics, logs, and traces with [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).
- **Enforce** — cap request and token usage per route, user, or key with [rate limiting]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).
- **Optimize** — route to cheaper models and cache repeated prompt content with [Optimize cost]({{< link-hextra path="/llm/cost-controls/optimize/" >}}).
