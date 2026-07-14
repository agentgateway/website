---
title: "Reduce LLM Spend With Semantic Routing You Can Measure"
category: "Deep Dive"
toc: false
publishDate: 2026-07-10
author: "Daneyon Hansen"
description: "Use agentgateway, vLLM Semantic Router, and catalog-priced telemetry to reduce routine coding-model spend without routing every request to the cheapest model."
---

I spend a lot of time in Go and Rust, where a quick "one more thing" in a
long coding chat can turn a tidy refactor into an hour of debugging. I do not
always remember to step down from the strongest model after the hard part is
over. A few routine tests, configuration edits, and follow-up questions later,
I have spent premium-model credits on work that did not need them.

Sending every request to a cheaper model is not the answer either. The
distributed-systems design, correctness work, and difficult debugging that
show up in those same conversations are exactly where I want more capable help.
I want the client to stay simple while the routing policy makes that choice.

This example combines [vLLM Semantic Router (vSR)](https://vllm-semantic-router.com/)
with [agentgateway](https://agentgateway.dev/) to send routine Go and Rust
coding tasks to `gpt-5.4-nano` and escalate more complex correctness,
distributed-systems, and deep-debugging work to `gpt-5.5`. I am not trying to
claim perfect routing accuracy. I want a reproducible way to show lower spend
without quietly routing every request to the cheapest tier.

## Make the Decision Observable

{{< reuse-image src="img/blog/cost-based-semantic-routing/semantic-routing-flow.svg" alt="Flow diagram: a coding agent sends model auto to agentgateway, vLLM Semantic Router selects either GPT-5.4 nano for routine coding or GPT-5.5 for complex coding, and agentgateway records catalog-priced telemetry" caption="One model name in, the appropriate model tier out - with the routing decision and realized cost visible at the gateway" >}}

I keep the client side boring: it sends an OpenAI-compatible request with
`model: "auto"`. An agentgateway policy sends the full request body to vSR.
vSR evaluates semantic, complexity, keyword, context, and structure signals,
then returns the selected model. Agentgateway forwards the request and records
what happened.

I do not ask vSR to use historic request cost as a classifier input. Cost is an
outcome that agentgateway measures after the request. That keeps the policy
explainable: the routing configuration says which work merits the stronger
model, while the gateway shows what that decision actually cost.

## Price the Outcome at the Gateway

Token counts are useful, but my company needs prices to make a budget decision.
Agentgateway loads a model cost catalog, calculates realized request cost, and
exposes the data in metrics, logs, and traces. The [model cost catalog
guide](https://agentgateway.dev/docs/kubernetes/latest/llm/cost-controls/costs/) explains how
to generate and load the catalog with `agctl`.

For this evaluation, I use the integrated [OpenTelemetry stack](https://agentgateway.dev/docs/kubernetes/main/observability/otel-stack/).
It adds Prometheus, Loki, Tempo, the OpenTelemetry Collector, and Grafana so
engineering and finance can inspect the same model-selection event:

- Prometheus carries token, duration, catalog-lookup, and cost signals.
- Logs and traces retain the selected model, request ID, latency, and cost.
- Grafana puts spend next to the signals needed to explain a routing decision.

## A Small, Reproducible Evaluation

I built the [cost-based semantic routing demo](https://github.com/danehans/agentgateway-demos/tree/main/cost-based-semantic-routing)
around a compact 24-prompt Go and Rust dataset. Half of the prompts are routine
implementation or test work; the other half involve correctness or
distributed-systems problems. I send every prompt through two lanes:

| Lane | Purpose |
|---|---|
| `routed` | vSR selects `gpt-5.4-nano` or `gpt-5.5`. |
| `always_expensive` | Every request uses `gpt-5.5`; the cost baseline. |

Each evaluation run has an ID attached to every request. The runner uses it in
its cost queries, which keeps unrelated traffic in the cluster out of the
result.

I deliberately leave out a forced-cheap lane. It would make the comparison
larger, but it would not answer the question I care about: does routing save
money while still escalating the work that deserves the expensive model?

In a clean run on July 13, 2026, all 48 primary requests completed with exact
model-catalog lookups. vSR selected `gpt-5.4-nano` for 16 requests and
`gpt-5.5` for 8. Catalog-priced agentgateway metrics reported `$0.231896` for
the routed lane versus `$0.405800` for the always-expensive lane, a **42.9%
cost reduction**. Routed p50 latency was **3.96 seconds**, compared with
**11.02 seconds** for the always-expensive lane. P95 was similar at 19.48 and
20.12 seconds because the requests that still use GPT-5.5 naturally determine
the tail.

![Catalog-priced semantic-routing result](/img/blog/cost-based-semantic-routing/20260713T184930Z-chart.svg)

The chart gives me the guardrail I need. It reached 83.3% tier agreement on the
checked-in coding sample and sent 8 of the 12 prompts labelled complex to
GPT-5.5. This is not a claim of perfect model selection. I read it as
evidence that the savings did not come from a blanket downgrade: one-third of
the routed requests still used the expensive model, including most of the
complex sample.

That is the useful scope for this example. It keeps higher-risk work on a more
capable model by policy and makes the exceptions visible. It is not a general
answer-quality benchmark or a substitute for an application's own task-success
and user-feedback measures.

## Try It

I made the demo do the setup work that I would otherwise forget or repeat by
hand. Behind the scenes, it uses the merged [agentgateway semantic-routing
example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing),
creates or reuses a kind cluster, and installs agentgateway, vSR, a model cost
catalog, and the OpenTelemetry stack. Before the primary requests run, it
checks readiness, routing, catalog-priced metrics, logs, and traces.

```bash
git clone https://github.com/danehans/agentgateway-demos.git
cd agentgateway-demos/cost-based-semantic-routing

export OPENAI_API_KEY='sk-...'
./demo.sh all --yes
```

The default run sends 54 billable requests: two routing probes, four smoke-test
requests, and 48 primary requests. It writes request-level JSONL, an
evaluation-scoped Prometheus report, and an SVG chart under `results/`.

When I want to change the policy, I edit the fetched vSR values, redeploy with
`./demo.sh router`, and run `./demo.sh eval --yes` again.

## Use It From Codex

Codex lets me choose a model manually, but that is one more decision to keep in
my head during a long Go or Rust task. A user-level Codex profile can instead
send every request to the corporate gateway with the stable `auto` model name:

```toml
# ~/.codex/agentgateway.config.toml
model = "auto"
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "Corporate agentgateway"
base_url = "https://my.corp.agentgateway.com/v1"
wire_api = "responses"
env_key = "OPENAI_API_KEY"
```

With `OPENAI_API_KEY` set to my OpenAI API key, I start Codex with
`codex --profile agentgateway`. The client sends OpenAI Responses API traffic
to agentgateway; vSR selects the actual tier and agentgateway records the
decision and realized cost. I validated this path with a routine table-driven
Go test request, which selected `gpt-5.4-nano`, and an advanced leader-election
request, which selected `gpt-5.5`.

The profile keeps credentials out of the configuration file. A company that
needs to prevent direct model selection can enforce that separately at the
gateway; `auto` is the supported path for this routing policy. Codex documents
[custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)
and user-level [configuration profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles).

## From Example to Rollout

I would not treat semantic routing as a magic cost switch. I would start with
an explainable policy and compare it against sending every request to the
expensive model. Then I would confirm that the policy uses both tiers and
protects complex work, and tune it against the signals that matter to the
application: task completion, feedback, retries, and escalation rates.

Agentgateway gives me the accounting and observability plane; vSR makes the
semantic decision. Together, they let me cut routine-model spend without
hiding a blanket downgrade behind an attractive cost chart.

## What's Next

I see cost-based semantic routing as one part of an LLM cost-management
practice. After validating a tiering policy, I can use
[agentgateway cost controls](https://agentgateway.dev/docs/kubernetes/main/llm/cost-controls/)
to attribute usage with virtual keys, observe realized spend by model and
consumer, and enforce budget or spend limits where I need them. That turns a
routing result into an operating model for keeping AI spend visible and under
control.

The agentgateway community is continuing to improve cost-based routing and the
tools around it. Future work will make it easier to tune, operate, and measure
model-tier decisions as real application traffic evolves.
