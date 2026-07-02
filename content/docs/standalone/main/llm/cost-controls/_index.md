---
title: Cost controls
weight: 60
description: Attribute, observe, enforce, and optimize LLM spend through agentgateway.
test: skip
---

Control LLM spend end to end, in four stages:

- **Attribute**: Tie usage to teams and keys with [virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).
- **Observe**: Compute the realized USD cost of every request with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}), see spend by model, provider, and user in the built-in [cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}), and view it in metrics, logs, and traces with [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).
- **Enforce**: Cap token usage and dollar spend per user or key with [budget and spend limits]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}), built on [rate limiting]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}).
- **Optimize**: Route to cheaper models and cache repeated prompt content with [Optimize cost]({{< link-hextra path="/llm/cost-controls/optimize/" >}}).
