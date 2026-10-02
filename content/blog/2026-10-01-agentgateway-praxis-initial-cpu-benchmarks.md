---
title: "Agentgateway and Praxis: initial CPU-only benchmarks"
category: "Deep Dive"
publishDate: 2026-10-01
author: "Daneyon Hansen"
description: "An initial comparison of AI proxy workloads and Gateway API behavior, with direct baselines, raw evidence, resource failures and single-run limitations."
---

Agentgateway handled the larger AI payloads substantially faster in our first CPU-only comparison with Praxis AI. The small OpenAI case was close, with Praxis ahead. That variation is why we are publishing the entire matrix, a direct-service baseline, and the limitations alongside the results.

This is an initial experiment: **one measurement per configuration**, not a statistically established ranking. It measures proxy behavior against a deterministic mock service. It does not measure inference throughput, model quality, GPU utilization, or inference routing.

The work follows our earlier [proxy benchmark](/blog/2026-06-26-benchmarking-agentgateway-vs-litellm/) and [fixed-throughput follow-up](/blog/2026-06-26-benchmarking-agentgateway-vs-litellm-part-2/). The [harness and complete evidence](https://github.com/danehans/agentgateway-benchmarks/tree/86a805c7d003c13d19b825fc84f842208c3c6e18/ai-gateway/results/2026-10-01-initial/) are public, including observations that do not favor agentgateway. This evaluation was conducted by Solo.io; it is not an independent third-party certification.

## Three treatments, three API paths

We compared released agentgateway **v1.5.0**, released Praxis AI **0.5.0**, and the mock backend directly. Praxis AI is the AI gateway component of the Praxis project family; testing Praxis core alone would not exercise its AI processing.

| Case | Client request | Upstream request |
| --- | --- | --- |
| OpenAI | Chat Completions | Chat Completions |
| Anthropic | Messages | Messages |
| Translation | Messages | Chat Completions |

Both gateways used their AI-aware routes. Their internal processing differs, even where the externally qualified behavior matches. The direct translation baseline uses native Chat Completions, so it checks backend capacity without isolating translation cost by subtraction.

Each API was tested with **1 KiB and 16 KiB of input and output content each**; JSON framing adds bytes. Each workload ran at 1,000 offered requests/second, 3,000 offered requests/second, and unrestricted throughput at 32 connections. Each trial had five seconds of warmup and 30 seconds of measurement. Treatment order was shuffled reproducibly per workload.

The host was a dedicated GCP n2-standard-16 Linux amd64 VM. Each gateway had two selected CPU threads on distinct guest-reported physical cores and a 2 GiB memory limit. The mock service and Fortio had separate two-core sets and memory limits. The inactive gateway was stopped. Agentgateway used two workers; Praxis configured two runtime threads per service, with one API listener receiving load per trial. [Exact configurations, image digests and topology](https://github.com/danehans/agentgateway-benchmarks/tree/86a805c7d003c13d19b825fc84f842208c3c6e18/ai-gateway/results/2026-10-01-initial/) are retained.

No TLS, external authorization, distributed rate limiting, cache, guardrails or real model was enabled. Those features need their own representative workloads before projecting production capacity.

## Saturation results

These are successful HTTP requests per second at unrestricted offered rate and 32 connections. The ratio is agentgateway divided by Praxis; it is specific to this configuration.

| API | Content size | Direct service | Agentgateway | Praxis AI | Agentgateway / Praxis |
| --- | ---: | ---: | ---: | ---: | ---: |
| OpenAI | 1 KiB | 41,381 | 13,663 | 14,079 | 0.970× |
| OpenAI | 16 KiB | 11,897 | 8,344 | 2,974 | 2.806× |
| Anthropic | 1 KiB | 41,444 | 13,605 | 12,139 | 1.121× |
| Anthropic | 16 KiB | 11,905 | 8,398 | 2,830 | 2.968× |
| Translation | 1 KiB | 42,095 | 13,191 | 6,428 | 2.052×* |
| Translation | 16 KiB | 11,874 | 8,324 | 1,538 | 5.413× |

*The 1 KiB Praxis translation result has a client-framing caveat described below.*

![Saturation throughput for every workload and both payload sizes](/images/blog/2026-10-01-praxis/saturation-throughput.png)

The strongest clean signal in this initial matrix is the larger native payloads: agentgateway achieved about **2.8–3.0×** Praxis AI's throughput. Praxis was about **3% ahead** on small OpenAI requests. One observation does not establish whether that small difference would persist across repetitions.

The direct baseline also matters. Agentgateway achieved roughly 31–33% of direct throughput for the smaller payloads and 70–71% for the larger payloads. Both proxies have meaningful work and overhead. The direct backend itself slows down with larger responses, so none of these figures is a universal proxy capacity limit.

## Fixed offered rates and errors

Across all 54 measured trials, Fortio recorded **10,091,467 requests and zero non-200 responses**. Before measurement, all 54 protocol checks passed, covering JSON content/usage, incremental SSE and upstream 429 handling across both sizes, the three APIs and all three treatments. Timed load validated HTTP status, not every response body. SSE correctness at low load is not a streaming performance result.

The predefined fixed-rate gate required at least 99% of offered QPS and at most 0.1% errors. Agentgateway and the direct service met it in every fixed-rate trial. Praxis missed it for all three 16 KiB workloads at 3,000 offered QPS:

| Praxis workload, 16 KiB | Successful QPS | Completion p99 |
| --- | ---: | ---: |
| OpenAI | 2,953.6 | 14.743 ms |
| Anthropic | 2,773.2 | 18.518 ms |
| Translation | 1,548.3 | 28.542 ms |

Those are offered-rate misses, not HTTP failures. [Both detailed reports](https://github.com/danehans/agentgateway-benchmarks/tree/86a805c7d003c13d19b825fc84f842208c3c6e18/ai-gateway/results/2026-10-01-initial/) show every achieved rate, p99 and error count, including the corresponding agentgateway and direct observations.

![Fixed-rate p99 latency with offered-rate misses marked](/images/blog/2026-10-01-praxis/fixed-rate-p99.png)

Fortio uses fixed concurrency and paced arrivals with catch-up disabled. When a treatment cannot sustain the offered rate, its latency histogram is not a corrected open-loop distribution. Read rate and latency together. Saturation p99 values occur at different achieved rates; subtracting them does not measure added proxy latency.

## A translation caveat worth investigating

Praxis's 1 KiB translation responses triggered Fortio's `Content-length missing` warning nearly once per request: 30,016 warnings at 1,000 offered QPS, 90,016 at 3,000 QPS, and 192,884 in the saturation trial. The logs are preserved.

Different HTTP framing and connection behavior, plus client logging, can affect this result. We therefore retain the observed numbers but do not present the small translation ratio as a clean translation-CPU comparison. The other five API/size combinations did not emit that warning. A follow-up should inspect connection reuse and framing and cross-check with another client before attributing the difference.

## Gateway API: correctness, plain HTTP and lifecycle

The [Gateway API reports, raw archive and reproduction instructions](https://github.com/danehans/agentgateway-benchmarks/tree/102b90639aa799de702a5082f677a546424b93df/gateway-api/results/2026-10-01-initial/) cover all initial attempts, including failures and earlier qualification problems.

We also exercised the Kubernetes controllers against the same Gateway API v1.5.1 core HTTP conformance suite. Both agentgateway v1.5.0 and Praxis operator revision `fb8beaa`, paired with its documented core 0.5.2 image, passed **33 tests with zero failures and zero core skips**. This does not establish extended-feature parity or an official certification.

The plain HTTP test tells a different throughput story. Using the community Gateway API benchmark suite on a separate 16-vCPU kind VM, Praxis core 0.5.2 was faster in both valid saturation configurations:

| Connections | Direct Service QPS | Agentgateway QPS | Praxis QPS |
| ---: | ---: | ---: | ---: |
| 1 | 16,556.9 | 6,451.0 | 8,131.5 |
| 16 | 103,922.6 | 43,077.9 | 51,007.2 |

These are single 60-second measurements of zero-payload HTTP, with all paths traversing a kind-provided Envoy TCP load balancer. They use Fortio 1.68.1 and shared host resources, unlike the AI campaign. The 512-connection attempts aborted; the direct load balancer logged `Too many open files` at its 1,024-descriptor limit. Those missing measurements do not rank either gateway.

At 16 connections and 10,000 offered QPS, Praxis's proxy was OOM-killed under the matched **256 MiB memory limit**, coinciding with 9,506 transport errors out of 600,000 requests. Its successful rate was 9,841.3 QPS; agentgateway achieved 9,999.7 QPS with zero errors. The 256 MiB setting comes from the Praxis operator and was matched on agentgateway. This is a result for that resource envelope, not evidence about larger memory limits or newer core versions. Praxis's saturation advantage and this fixed-rate failure both belong in the comparison.

The route-update observations also need precise interpretation. Both gateways completed 1,000 configuration changes while the suite's traffic probe continued receiving HTTP 200. Agentgateway completed the 1,000-route first-response propagation test, with 13.066 ms mean and 23.407 ms maximum after the apply call. Praxis's propagation attempt aborted on a connection reset at the first route, so it produced no comparable latency distribution. The probe stops on transport errors, and one failure does not establish how frequently that would occur. These tests do not validate every intermediate header transformation.

The scale/churn workload creates synthetic Kubernetes objects and updates configuration continuously. Agentgateway had all 1,000 and 5,000 routes accepted, reference-resolved and at current observedGeneration in both the five- and nine-minute snapshots. Praxis's 1,000-route snapshots left 995 routes without parent conditions. At 5,000 routes, its operator logged Kubernetes rejecting the generated ConfigMap because it exceeded the [1 MiB ConfigMap limit](https://kubernetes.io/docs/concepts/configuration/configmap/). That is a configuration-delivery limit for this operator revision and fixture, not a universal route-count ceiling. These checkpoints measure configuration status, not successful traffic to thousands of real backends.

The operator/core pairing matters. In an earlier qualification attempt, the same Praxis operator with newer core 0.7.2 generated an empty router for a Gateway with no HTTPRoutes, and that core exited with `routes is empty`. Its documented 0.5.2 image started successfully and was used for the shared comparison. This is a specific integration finding, not a general claim about Praxis reliability.

## Reproduce and extend the experiment

The [benchmark source](https://github.com/danehans/agentgateway-benchmarks/tree/86a805c7d003c13d19b825fc84f842208c3c6e18/ai-gateway) provides pinned Compose configuration, a deterministic mock, protocol checks, a bounded runner, and scripts that regenerate the two separate reports: **agentgateway versus direct service**, and **Praxis versus agentgateway**. The [result directory](https://github.com/danehans/agentgateway-benchmarks/tree/86a805c7d003c13d19b825fc84f842208c3c6e18/ai-gateway/results/2026-10-01-initial/) contains the entire raw archive and checksums. No successful or failed trial was removed to improve a headline.

Run on a dedicated native Linux amd64 Docker host, inspect physical-core topology, set disjoint CPU sets, and use `python3 campaign.py --initial --output /tmp/ai-initial-001`. The README explains requirements and the separate repeated-campaign mode. An emulated local run is a compatibility check, not comparable performance evidence.

The next useful steps are repeated, counterbalanced measurements; a second load generator; resolution of the small-translation framing caveat; and representative streaming, TLS and policy workloads. GPU inference requires a separate experiment. For now, the evidence supports a promising large-payload result for agentgateway and a concrete, reproducible basis for further investigation.
