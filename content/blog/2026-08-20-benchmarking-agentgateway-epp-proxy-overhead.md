---
title: "How Agentgateway Performs as an Inference Gateway"
category: "Deep Dive"
publishDate: 2026-08-20
author: "Abhay Chaurasiya"
description: "A GSoC 2026 project measuring how agentgateway performs as an inference gateway — both as EPP's standalone sidecar and as a Gateway API data plane — compared to a plain Kubernetes Service with no gateway at all."
---

# How Agentgateway Performs as an Inference Gateway

*A GSoC 2026 project summary — Abhay Chaurasiya, mentored by Nina Polshakova
and Daneyon Hansen, CNCF*

## The Backstory

This work originally started as an attempt to benchmark the inference
routing extension in kgateway ([kgateway-dev/kgateway#12289](https://github.com/kgateway-dev/kgateway/issues/12289)).
As we got further into it, though, it made more sense to focus on
agentgateway instead. Since agentgateway is the component acting as the
sidecar proxy for EPP, benchmarking there gives us a more direct picture of
the impact. The work has been tracked in
[agentgateway/agentgateway#85](https://github.com/agentgateway/agentgateway/issues/85)
since then.

For the benchmarking itself, we built on top of
[llm-d-benchmark](https://github.com/llm-d/llm-d-benchmark) rather than
putting together a separate harness. We reused its CLI and comparison
templates, which let us get started quickly and kept the benchmarking
approach aligned with the existing tooling. Working with it also surfaced
a few issues in the shared tools, some of which we were able to fix
upstream.

## The Goal

Agentgateway can run as EPP's (Endpoint Picker's) proxy sidecar, routing
inference traffic to model servers based on live signals like KV-cache
utilization and queue depth, instead of just round-robin. That kind of
routing takes more work per request than plain round-robin does, but until
now nobody had actually measured how much.

This project's goal was to build a real, repeatable way to measure that —
how agentgateway performs against a plain Kubernetes Service with no
gateway at all, in both of the ways it can run (as EPP's standalone
sidecar, and as an in-cluster Gateway) — and to make that measurement
something the project can keep running over time, not a one-off number.

## What We Measured

The numbers below come from GPU benchmark runs on 16 x H100 GPUs (Qwen/Qwen3-32B across 8 vLLM model servers with TP=2), comparing three setup options on the exact same cluster and hardware:

- **Kubernetes Service (RR)**: a plain Kubernetes Service round-robining across the 8 model-server pods — no EPP, no smart routing.
- **Agentgateway Standalone**: agentgateway running as EPP's sidecar proxy over localhost, with no Kubernetes Gateway in front.
- **Agentgateway on Kubernetes**: agentgateway running as the Gateway API data plane, with EPP picking backends through an InferencePool.

Here is how the three setups compare under heavy load (60 QPS request-rate stage, zero request failures):

| Metric | Kubernetes Service (RR) | Agentgateway Standalone | Agentgateway on Kubernetes |
|---|---:|---:|---:|
| Peak output tokens/s | 6,910 | 16,178 (+134.1%) | 14,241 (+106.1%) |
| Requests/sec | 6.70 | 16.52 (+146.5%) | 13.96 (+108.3%) |
| TTFT p50 | 62.9s | 0.1s (-99.8%) | 0.2s (-99.7%) |
| TTFT p90 | 135.6s | 0.2s (-99.8%) | 0.2s (-99.8%) |

<img src="/img/blog/benchmarking-agentgateway-epp-proxy-overhead/standalone-throughput_vs_qps.svg" width="900" alt="Throughput vs QPS, Kubernetes Service vs Agentgateway Standalone">
<img src="/img/blog/benchmarking-agentgateway-epp-proxy-overhead/standalone-ttft_p90_vs_qps.svg" width="900" alt="TTFT p90 vs QPS, Kubernetes Service vs Agentgateway Standalone">

Notice that the latency gap isn't a constant "proxy tax" — it opens up as request load increases. At light load (3 QPS), all three setups perform almost identically. The difference only shows up once traffic ramps up and the plain Kubernetes Service starts piling requests behind whichever pod round-robin happens to hit (its TTFT p50 jumps from 0.5s to 62.9s). By contrast, agentgateway with EPP continuously routes traffic to pods with available capacity.

The one metric where round-robin looks lower on paper — inter-token latency (30.3ms vs ~50ms p50 at 60 QPS) — is actually expected behavior. Because vLLM uses continuous batching, taking on more concurrent requests trades slightly higher per-token generation time for vastly higher total throughput. In short, higher inter-token latency under load is just vLLM keeping the GPUs fully saturated.

Running agentgateway as an in-cluster Kubernetes Gateway (via Gateway API HTTPRoute + InferencePool) shows the same pattern: slightly lower peak throughput than standalone sidecar mode (14,241 vs 16,178 tokens/s, but still double plain round-robin) while keeping TTFT sub-second under load:

<img src="/img/blog/benchmarking-agentgateway-epp-proxy-overhead/gateway-throughput_vs_qps.svg" width="900" alt="Throughput vs QPS, Kubernetes Service vs Agentgateway on Kubernetes">
<img src="/img/blog/benchmarking-agentgateway-epp-proxy-overhead/gateway-ttft_p90_vs_qps.svg" width="900" alt="TTFT p90 vs QPS, Kubernetes Service vs Agentgateway on Kubernetes">

## How It's Built

Instead of writing and maintaining custom benchmarking scripts, this uses [llm-d-benchmark](https://github.com/llm-d/llm-d-benchmark)'s tooling. A single command (`make benchmark`) spins up the test targets on a cluster, runs the load test through `inference-perf`, and generates comparison reports. It manages its own `llm-d-benchmark` checkout automatically so there is no manual setup needed.

Working on this also turned up a few real upstream issues — a broken image tag in the `llm-d-router` release chart, and a missing CLI flag in `llm-d-benchmark`'s `standup` command (both filed, second one merged). While testing the GPU benchmark workflow locally, I caught another edge case: two guard clauses in the runner script were exiting with code 1 instead of returning 0 on the default Kind provider path, silently killing local runs. Because the upstream unit tests only covered the GKE branch, the issue went unnoticed — we patched it and verified the local Kind path end-to-end before merging.

## Work Accomplished This Summer

Everything below is real, merged or open work, not a summary of intentions:

**agentgateway/agentgateway**
- [#1758](https://github.com/agentgateway/agentgateway/pull/1758) - InferencePool targetRef support in AgentgatewayPolicy (merged)
- [#2003](https://github.com/agentgateway/agentgateway/pull/2003) - fixed a misleading Chart.yaml appVersion placeholder (merged)
- [#2073](https://github.com/agentgateway/agentgateway/pull/2073) - fixed a stale version reference and broken OCI URL in the syncer README (merged)
- [#2526](https://github.com/agentgateway/agentgateway/pull/2526) - the original benchmark comparison this post grew out of (superseded by the dedicated benchmarks repo below)
- [#1816](https://github.com/agentgateway/agentgateway/pull/1816) - EPP ordered destination-endpoint fallback (open, in progress with mentor)

**agentgateway/benchmarks**
- [#1](https://github.com/agentgateway/benchmarks/pull/1) - the benchmark comparison this post is about, now in its own dedicated repo (open, awaiting final review)

**llm-d/llm-d-router**
- [#1600](https://github.com/llm-d/llm-d-router/pull/1600) - aligned agentgateway's standalone config with upstream GAIE's pseudo-service model (merged)

**llm-d/llm-d-benchmark**
- [#1655](https://github.com/llm-d/llm-d-benchmark/pull/1655) - fixed the epponly HTTP port for agentgateway's proxyType (merged)

**llm-d/llm-d**
- [#1719](https://github.com/llm-d/llm-d/pull/1719) - documented agentgateway as a supported proxyType in the standalone router guides (merged)

## Current State

The core comparison between a plain Service and agentgateway is built, automated, and tested end-to-end. Daneyon Hansen expanded this into a full campaign-based benchmark system covering three treatments (plain Service, agentgateway standalone, and agentgateway on Kubernetes), complete with automated GKE cluster provisioning/teardown and the H100 GPU results above. That work, along with the local Kind-path fix we verified on a real cluster, has since moved into its own dedicated repo, [agentgateway/benchmarks](https://github.com/agentgateway/benchmarks/pull/1).

## Remaining Tasks and Future Work

- Get agentgateway/benchmarks#1 merged upstream
- Add additional workload profiles as requested by mentors

**Future work: automated regression detection.** Right now, this benchmark runs on demand when triggered. The next step is a CI gate that compares a new run's tail latency against a stored baseline and fails the build if it crosses a threshold — the same fail-hard limit pattern I used on `MaxSearchResults` in Jaeger's MCP server earlier this year. I built and verified the core scripts (`check_regression.py`) locally against real project data, but keeping it off CI for now while we decide where the baseline data should live long-term (in-repo vs. cloud storage).

## Challenges and Lessons Learned

The thing that came up more than once was simple: check the current state
before assuming you know what's going on. I got burned by a stale local
git clone twice this summer. One time, I filed an issue for something that
had already been fixed upstream. Another time, I almost brought back a bug
that had already been patched. Both times, the problem was trusting what I
remembered or what my local code showed instead of checking what was
actually happening right now.

Another thing I learned was not to treat changing direction as a failure.
The benchmarking approach changed a few times during the project. We
started with custom scripts, then moved to llm-d-benchmark's tooling. The
comparison went from three setups to two, and we eventually moved from a
CPU simulator run to real GPU hardware. Those changes came out of feedback
and what we were seeing as the work progressed. Nothing was really wasted,
though. Each change built on what we'd already done and left us with
something useful.

## Thanks

Thanks to my mentors, Nina Polshakova and Daneyon Hansen, for pointing this
in the right direction through a few scope changes along the way, and to
the llm-d-benchmark maintainers for tooling that meant I didn't have to
build a benchmarking harness from scratch.
