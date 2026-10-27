---
title: Cost controls
weight: 60
description: Attribute, observe, enforce, and optimize LLM spend through agentgateway.
test: skip
---

Control LLM spend end to end, in three stages:

- **Attribute**: Tie usage to teams and keys with [virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}), and carry the attribution value onto the cloud provider's own bill with [invoice-grade attribution]({{< link-hextra path="/documentation/llm/cost-controls/attribution/" >}}).
- **Observe**: Compute the realized USD cost of every request with a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}), see spend by model, provider, and user in the built-in [cost dashboard]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/" >}}), and view it in metrics, logs, and traces with [Observe traffic]({{< link-hextra path="/documentation/llm/observability/" >}}).
- **Enforce**: Cap token usage and dollar spend with [budget and spend limits]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/" >}}), either as a [per-key budget]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}) or as a [rate limit token budget]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/rate-limit/" >}}).

