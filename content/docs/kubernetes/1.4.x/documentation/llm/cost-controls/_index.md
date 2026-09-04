---
title: Cost controls
weight: 30
description: Attribute, observe, enforce, and optimize LLM spend through agentgateway.
test: skip
---

Control LLM spend end to end, in stages:

- **Attribute**: Tie usage to teams and keys with [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}), and carry the attribution value onto the cloud provider's own bill with [invoice-grade attribution]({{< link-hextra path="/documentation/llm/cost-controls/attribution/" >}}).
- **Observe**: Compute the realized USD cost of every request with a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}), see spend by model, provider, and user in the built-in [cost dashboard]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/" >}}), or estimate it from token metrics with [LLM cost tracking]({{< link-hextra path="/documentation/llm/cost-controls/cost-tracking/" >}}).
- **Enforce**: Set per-key and per-route spend caps with [budget and spend limits]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/" >}}), built on [rate limiting]({{< link-hextra path="/documentation/llm/rate-limit/" >}}).

