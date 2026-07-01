---
title: Cost controls
weight: 60
description: Attribute, observe, enforce, and optimize LLM spend through agentgateway.
test: skip
---

Control LLM spend end to end, in stages:

- **Attribute** — tie usage to teams and keys with [virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).
- **Observe** — compute the realized USD cost of every request with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}), or estimate it from token metrics with [LLM cost tracking]({{< link-hextra path="/llm/cost-controls/cost-tracking/" >}}).
- **Enforce** — set per-key and per-route spend caps with [budget and spend limits]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}), built on [rate limiting]({{< link-hextra path="/llm/rate-limit/" >}}).
- **Optimize** — alias to cheaper models and cache repeated prompt content with [Optimize cost]({{< link-hextra path="/llm/cost-controls/optimize/" >}}).
