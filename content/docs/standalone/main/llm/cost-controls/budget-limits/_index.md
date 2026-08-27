---
title: Budget and spend limits
weight: 40
description: Cap LLM spend per API key in dollars or tokens, with per-key budgets or with rate limiting.
test: skip
---

Cap how much each API key can spend on LLM traffic, in US dollars or in tokens.

## About budget and spend limits

Agentgateway has two ways to cap LLM usage. They solve different problems, and you can use both at the same time.

| | Per-key budgets | Rate limit token budgets |
| -- | -- | -- |
| Where you configure it | Each entry in `apiKey.keys` | A `localRateLimit` or `remoteRateLimit` policy |
| Unit | US dollars or tokens | Tokens only, so a spend cap is an estimate that drifts when prices or the model mix change |
| Scope | One API key | Gateway-wide for a local limit, or any descriptor you choose for a remote limit |
| Window | A fixed window that is aligned to the Unix epoch | A token bucket that refills at an interval |
| Where the count lives | A database that agentgateway manages | Memory for a local limit, or a rate limit server for a remote limit |
| Action when the limit is reached | Reject the request, or record the overage and allow it | Reject the request |
| Extra components | A database | A rate limit server, for per-user limits |
| Modes | Standalone only | Standalone and Kubernetes |
| When to choose it | You want a true dollar cap, because a budget charges the realized cost of each request | You want to smooth burst traffic, because a token bucket refills continuously and a budget window does not, or you run in Kubernetes mode |

- [Per-key dollar or token budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/per-key/" >}}) caps what one API key spends, in dollars or tokens, and limits which models it can reach.
- [Rate limit token budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/rate-limit/" >}}) caps token usage with a token bucket, per user or gateway-wide.

> [!NOTE]
> Per-key budgets work in standalone mode only. The Kubernetes API does not carry the `budgets` or `allowedModels` fields, so a Kubernetes deployment uses [rate limit token budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/rate-limit/" >}}).

## How per-key budgets work

A budget belongs to one entry in `apiKey.keys`. Each budget has a name, a limit, a window, and an action to take when the key goes over the limit.

Every budget needs a database. Agentgateway keeps the running count for each budget in the database that you set in `config.database`, and refuses to start when a key has a budget but that section is missing. To set up the database, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

Agentgateway charges usage to a budget **after** the LLM response returns, because the provider reports the token counts and the cost only in the response. This ordering has two consequences:

- The request that crosses the limit still completes. Agentgateway rejects the **next** request. A budget is therefore a cap on what a key can start, not a hard ceiling on what it spends.
- When the provider does not report the unit that the budget needs, agentgateway does not charge the request at all. Agentgateway logs the request, but cannot charge or reject the request after the fact.

Agentgateway holds the running count in memory and writes it to the database every five seconds, which keeps the database off the request path. The database also makes the count survive a restart.

## How budget windows work

A window is aligned to the Unix epoch, not to the first request that uses the key. A `1h` window follows UTC clock hours, a `24h` window starts at midnight UTC, and a `30d` window uses consecutive 30-day periods rather than calendar months. Every key with the same window length therefore resets at the same moment.

## Guides
