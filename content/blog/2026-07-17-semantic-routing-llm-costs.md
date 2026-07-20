---
title: "Reduce LLM Spend with Semantic Routing"
category: "Deep Dive"
toc: true
publishDate: 2026-07-20
author: "Daneyon Hansen"
description: "Use agentgateway, vLLM Semantic Router, and catalog-priced telemetry to reduce routine coding-model spend without routing every request to the cheapest model."
---

I spend a lot of time in Go and Rust, where a quick "one more thing" in a long
coding chat can turn a tidy refactor into an hour of debugging. After the hard
part is over, routine tests and follow-up questions can still burn
premium-model credits. Sending every request to a cheaper model is not the
answer: distributed-systems design, correctness work, and difficult debugging
need more capable help.

This example combines [vLLM Semantic Router (vSR)](https://vllm-sr.ai/)
with [agentgateway](https://agentgateway.dev/) to send routine Go and Rust
coding tasks to `gpt-5.4-nano` and escalate complex correctness,
distributed-systems, and deep-debugging work to `gpt-5.5`. The goal is a
reproducible cost reduction without quietly routing everything to the cheapest
tier.

## Make the Decision Observable

{{< reuse-image src="img/blog/cost-based-semantic-routing/semantic-routing-flow.svg" alt="Flow diagram: a coding agent sends model auto to agentgateway, vLLM Semantic Router selects either GPT-5.4 nano for routine coding or GPT-5.5 for complex coding, and agentgateway records catalog-priced telemetry" caption="One model name in, the appropriate model tier out - with the routing decision and realized cost visible at the gateway" >}}

The client sends an OpenAI-compatible request with `model: "auto"`. An
agentgateway policy sends it to vSR, which evaluates semantic, complexity,
keyword, context, and structure signals before selecting a model. Agentgateway
forwards the request and records the outcome. Cost is not a classifier input;
it is measured after the request, keeping the policy explainable.

`auto` opts into that automatic selection. A client can instead request
`gpt-5.4-nano` or `gpt-5.5` directly to force a tier and bypass automatic
routing; the request still passes through agentgateway. Organizations
that require automatic routing can use a [request-body
transformation](https://agentgateway.dev/docs/kubernetes/latest/traffic-management/transformations/validate/)
to rewrite every request to `auto`.

## Price the Outcome at the Gateway

My company needs prices, not just token counts, to make a budget decision.
Agentgateway loads a model cost catalog and exposes realized request cost in
metrics, logs, and traces. The [model cost catalog
guide](https://agentgateway.dev/docs/kubernetes/latest/llm/cost-controls/costs/) explains how
to generate and load the catalog with `agctl`.

For this evaluation, I use the integrated [OpenTelemetry stack](https://agentgateway.dev/docs/kubernetes/main/observability/otel-stack/).
Prometheus, Loki, Tempo, the OpenTelemetry Collector, and Grafana let
engineering and finance inspect the same model-selection event.

## A Small, Reproducible Evaluation

I built the [cost-based semantic routing demo](https://github.com/danehans/agentgateway-demos/tree/main/cost-based-semantic-routing)
around a compact 50-prompt Go and Rust dataset. Half of the prompts are routine
implementation or test work; the other half involve correctness or
distributed-systems problems. I send every prompt through two lanes:

| Lane | Purpose |
|---|---|
| `routed` | vSR selects `gpt-5.4-nano` or `gpt-5.5`. |
| `always_expensive` | Every request uses `gpt-5.5`; the cost baseline. |

Each run has an ID on every request, so its cost query excludes unrelated
cluster traffic. I deliberately leave out a forced-cheap lane: the useful
comparison is whether routing saves money while still escalating complex work.

Each prompt has an expected tier in the checked-in dataset: 25 routine prompts
expect `gpt-5.4-nano`, and 25 complex prompts expect `gpt-5.5`. Expected-tier
agreement is the share of requests where vSR selected that labelled tier. It
checks the routing policy, not the quality of the model's answer.

In a clean run on July 16, 2026, all 100 primary requests completed with exact
model-catalog lookups. vSR selected `gpt-5.4-nano` for 30 requests and
`gpt-5.5` for 20. Catalog-priced agentgateway metrics reported `$0.591444` for
the routed lane versus `$0.914840` for the always-expensive lane, a **35.4%
cost reduction**. Routed p50 latency was **5.22 seconds**, compared with
**7.55 seconds** for the always-expensive lane. P95 was 19.09 seconds for
routed traffic and 19.61 seconds for the always-expensive lane.

![Catalog-priced semantic-routing result](/img/blog/cost-based-semantic-routing/20260716T202619Z-chart.svg)

The chart reached **90% expected-tier agreement (45 of 50 prompts)**. All 25
routine prompts stayed on nano, and 20 of 25 complex prompts escalated to
GPT-5.5. This is not a claim of perfect model selection, but it shows the
savings did not come from a blanket downgrade: 40% of routed requests still
used the expensive model. It is a policy sanity check, not an answer-quality
benchmark or a substitute for application task-success and user-feedback data.

The default dataset uses independent requests. For long-running coding agents,
the optional cache-transition evaluation uses two ordered ten-turn Go and Rust
conversations with a stable prefix. It reports provider-observed cache reads by
model transition without mixing cache behavior into the primary evaluation.

## Try It

The demo automates the setup work I would otherwise repeat by hand. It uses the [agentgateway semantic-routing
example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing),
creates or reuses a kind cluster, and installs agentgateway, vSR, a model cost
catalog, and the OpenTelemetry stack. It checks readiness, routing,
catalog-priced metrics, logs, and traces before the primary requests run.

Before running it, review the [demo requirements](https://github.com/danehans/agentgateway-demos/tree/main/cost-based-semantic-routing#requirements):
12 GiB of Docker memory, 30 GiB of free disk, the required CLIs, an OpenAI API
key, and access to both models.

```bash
git clone https://github.com/danehans/agentgateway-demos.git
cd agentgateway-demos/cost-based-semantic-routing

export OPENAI_API_KEY='sk-...'
./demo.sh all --yes
```

The default run sends 106 billable requests: two routing probes, four smoke-test
requests, and 100 primary requests. It writes request-level JSONL, an
evaluation-scoped Prometheus report, and an SVG chart under `results/`.

When I want to change the policy, I edit the fetched vSR values, redeploy with
`./demo.sh router`, and run `./demo.sh eval --yes` again.

## Use It From Codex

Codex lets me choose a model manually, but a user-level profile can instead
send every request to a gateway such as agentgateway with the stable `auto`
model name:

```toml
# ~/.codex/agentgateway.config.toml
model = "auto"
model_provider = "agentgateway"

[model_providers.agentgateway]
name = "Corporate agentgateway"
base_url = "https://my.corp.agentgateway.com/v1"
wire_api = "responses"
```

I start Codex with `codex --profile agentgateway`. It sends OpenAI Responses
API traffic to agentgateway; vSR selects the tier and agentgateway records the
decision and realized cost. I validated routine Go test traffic to nano and an
advanced leader-election request to GPT-5.5.

Current Codex emits an `unknown model auto` fallback-metadata warning. Routing
still works, but Codex warns that the fallback metadata may degrade behavior.

The profile keeps credentials out of the configuration file. Codex documents
[custom model providers](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)
and user-level [configuration profiles](https://learn.chatgpt.com/docs/config-file/config-advanced#profiles).

## From Example to Rollout

Semantic routing is not a magic cost switch. Start with an explainable policy,
compare it with always using the expensive model, confirm it uses both tiers,
and tune it against task completion, feedback, retries, and escalation rates.
Agentgateway supplies the accounting and observability; vSR makes the semantic
decision.

This example is intentionally static: it uses configured keywords, semantic
candidates, weights, and thresholds rather than learning from application
outcomes. Those signals need periodic review as traffic changes. The
agentgateway community and vSR project are continuing work to make semantic
routing easier to tune, operate, and measure against real application traffic,
so stay tuned.

## What's Next

After validating a tiering policy, use [agentgateway cost controls](https://agentgateway.dev/docs/kubernetes/main/llm/cost-controls/)
to attribute usage with virtual keys, observe realized spend by model and
consumer, and enforce budget or spend limits.
