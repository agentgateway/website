---
title: Cost controls
weight: 60
description: Attribute, observe, enforce, and optimize LLM spend through agentgateway.
test: skip
---

Control LLM spend end to end, in stages:

- **Attribute**: Tie usage to teams and keys with [virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).
- **Observe**: Compute the realized USD cost of every request with a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}), see spend by model, provider, and user in the built-in [cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}), or estimate it from token metrics with [LLM cost tracking]({{< link-hextra path="/llm/cost-controls/cost-tracking/" >}}).
- **Enforce**: Set per-key and per-route spend caps with [budget and spend limits]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}), built on [rate limiting]({{< link-hextra path="/llm/rate-limit/" >}}).

