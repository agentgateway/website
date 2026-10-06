---
title: "Agentgateway v1.6.0 and Praxis: Gateway API and AI gateway benchmarks"
category: "Deep Dive"
publishDate: 2026-10-05
author: "Daneyon Hansen"
description: "Three-pass CPU comparisons of agentgateway and Praxis release/nightly builds, with direct baselines, Gateway API evidence, resource observations and reproducible results."
---

Choosing a gateway requires more than one throughput number. This comparison separates plain forwarding, native AI processing, Gateway API behavior and configuration lifecycle. It retains results that favor either project, alongside a direct-service reference.

We tested agentgateway **v1.6.0**, Praxis core **v0.5.2** and **nightly-20261002**, and the separate Praxis AI **v0.5.0** and **October 2 nightly**. Every completed performance workload has three repetitions. Solo.io conducted this evaluation and contributes to agentgateway; this is not an independent certification.

The [complete comparison](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/README.md) includes separate reports for [agentgateway versus direct service](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/01-agentgateway-vs-direct.md) and [Praxis versus agentgateway](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/02-praxis-vs-agentgateway.md). The [headline calculations](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/data/article-calculations.json) identify their exact cases and raw artifact paths. The [public evidence guide](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/docs/PUBLIC-EVIDENCE.md) links downloadable raw outputs, checksums, source and reproduction instructions.

## Separate distributions and workloads

Praxis core and Praxis AI answer different questions. Core forwards the AI-protocol traffic in our common profile. The AI distribution applies its native filters in a separate profile. Its release uses core libraries 0.7.2, so it must not be labeled core v0.5.2. The AI nightly was resolved through its successful October 2 publishing workflow and SHA-tag digest.

| Profile | What it measures | Praxis treatments |
| --- | --- | --- |
| Common forwarding | Plain HTTP and OpenAI/Anthropic JSON and streaming transport | Core v0.5.2 and core nightly-20261002 |
| Native AI | OpenAI Chat Completions, Anthropic Messages and Messages-to-Chat-Completions translation | AI v0.5.0 and AI October 2 nightly |
| Kubernetes | HTTP, route create/update, graceful recovery and a focused corrected conformance check | Core v0.5.2 with operator fb8beaa; stock nightly pairing setup-blocked |

Agentgateway v1.6.0 and direct service are references in each runnable profile. Common forwarding omits native AI transformation and accounting. Native profiles have different routing and accounting implementations. Praxis's `token_count` extracts response usage; its name does not imply prompt tokenization. We did not independently audit accounting accuracy.

The native translation baseline sends Chat Completions directly, while gateway clients send Messages. Agentgateway explicitly uses its Messages-to-Chat-Completions fallback. Those differences prevent a simple subtraction from isolating translation cost.

## Native GCP infrastructure and three passes

Client, gateway and deterministic service ran on separate native Compute Engine VMs. Standalone gateways had two pinned guest cores, a two-CPU quota and 2 GiB memory. The Kubernetes profile used five separate K3s nodes, a two-CPU/256 MiB gateway limit, and private NodePort traffic.

There was no Envoy proxy, GKE cluster or managed GCP load balancer in the measured path. Nighthawk is an additional load client from the Envoy project. MetalLB supplied test address allocation, not the measured HTTP path.

Fortio measured fixed-rate and unrestricted HTTP workloads. Nighthawk supplied another fixed-rate view. NVIDIA AIPerf measured streaming latency against a paced CPU fixture. ClusterLoader2 submitted route mutations, followed by generation-aware status and traffic checks.

Fortio and Nighthawk used five seconds of warmup and 30 seconds of measurement. AIPerf used a fixed corpus seed, 128 input tokens, 64 output tokens, five seconds of warmup and a 30-second measurement. The mock delays the first token by about 25 ms, then emits tokens about 5 ms apart. **There are no GPU, real-model inference, model-quality or inference-cost results here.**

Treatment order rotated across three passes on the same placement. Bars show arithmetic means; dots show each pass. This measures repeatability on these hosts, not variation across independently provisioned cloud placements. All prespecified load cases are retained, and rejected infrastructure pilots are disclosed separately.

## Native AI throughput depends on the workload

These are successful requests per second at unrestricted offered rate. Payload sizes describe content in both request and response; JSON framing adds bytes. Each cell is the mean of three passes followed by its minimum–maximum range.

| API / content / connections | Direct service | Agentgateway v1.6.0 | Praxis AI v0.5.0 | Praxis AI Oct 2 nightly |
| --- | ---: | ---: | ---: | ---: |
| anthropic / 1 KiB / 32 | 60,099 [59,160–60,756] | 14,158 [13,781–14,467] | 12,075 [11,979–12,220] | 12,108 [11,705–12,340] |
| anthropic / 16 KiB / 32 | 10,267 [10,215–10,334] | 7,347 [7,214–7,438] | 2,700 [2,640–2,755] | 2,654 [2,628–2,677] |
| openai / 1 KiB / 32 | 58,425 [57,827–58,983] | 14,041 [13,871–14,211] | 13,398 [13,074–13,967] | 12,985 [12,897–13,115] |
| openai / 1 KiB / 512 | 70,812 [69,812–71,367] | 12,205 [12,014–12,361] | 11,106 [11,075–11,150] | 11,126 [10,969–11,258] |
| openai / 16 KiB / 32 | 10,031 [9,976–10,060] | 7,399 [7,321–7,488] | 2,838 [2,811–2,859] | 2,714 [2,682–2,731] |
| openai / 16 KiB / 512 | 14,377 [14,244–14,477] | 6,810 [6,718–6,872] | 2,693 [2,682–2,701] | 2,626 [2,613–2,637] |
| translation / 1 KiB / 32 | 58,358 [57,366–59,208] | 12,822 [12,503–13,295] | 7,118 [7,063–7,218] | 7,025 [6,936–7,111] |
| translation / 16 KiB / 32 | 10,081 [10,064–10,101] | 7,172 [7,116–7,226] | 1,507 [1,497–1,519] | 1,460 [1,456–1,468] |

![Native AI successful throughput across all unrestricted-rate cases, with each repetition shown](/images/blog/2026-10-05-praxis/native-ai-fortio.png)

At 32 connections with 16 KiB content, agentgateway's mean throughput was **2.61–2.77×** the two Praxis AI builds for native OpenAI/Anthropic traffic, and **4.76–4.91×** for translation. The table also retains the smaller-payload and 512-connection results; these are workload-specific observations.

Both gateways perform substantial work compared with direct service. Direct throughput can also approach client or backend capacity, so it is an observed path reference, not an unconstrained service ceiling. Native throughput ratios compare these configured profiles; they do not prove equal-work CPU efficiency.

The [full native matrix](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/matrices/native-ai.md) also retains every 1,000- and 3,000-request/second case, delivered rate, latency and error result. At a fixed offered rate, read delivered throughput beside latency. At unrestricted rates, treatments run at different achieved loads; subtracting their latencies does not isolate added proxy latency.

## Streaming latency is close on the paced fixture

Native-profile mean time to first token (TTFT) was about 26.6–27.8 ms across the gateways. Both Praxis AI builds had lower means than agentgateway in the four native OpenAI/Anthropic combinations; translation differences varied. These sub-millisecond differences sit on a fixture with an approximately 25 ms initial delay. They do not establish real-model latency or a universal streaming winner. The [streaming plot](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/figures/native-ai-aiperf.png) and [full matrix](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/matrices/native-ai.md) retain all repetitions, latency metrics and errors.

## Plain forwarding can favor Praxis

Praxis core v0.5.2 had higher mean successful throughput than agentgateway in **6 of 6** unrestricted plain-HTTP configurations; core nightly did so in **4 of 6**. These counts describe this matrix, not an overall quality score. The complete chart keeps both Praxis versions and the direct baseline visible.

![Standalone plain HTTP throughput at all unrestricted-rate payload and connection combinations](/images/blog/2026-10-05-praxis/common-http-fortio.png)

The [common HTTP matrix](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/matrices/common-http.md), [AI-protocol transport matrix](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/matrices/common-ai.md) and [Kubernetes matrix](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/matrices/kubernetes-http.md) keep those profiles separate. A faster core forwarding result does not establish native AI feature parity. Conversely, broader Gateway API coverage does not erase a forwarding advantage.

Across **822 accepted load cases**, every load-tool process exited successfully, with **zero confirmed HTTP/AIPerf errors or Nighthawk resets**. Nighthawk separately recorded 26 requests in flight at cutoff; they are not automatically failed requests. All 360 protocol checks and 60 cancellation checks passed. Fortio timed load checks status; it does not validate every response body.

Resource results include sampled CPU, cgroup memory and file descriptors. Sampled CPU use left client/backend headroom on through-gateway paths; direct unrestricted traffic approached those limits. No accepted HTTP window encountered descriptor exhaustion. One client telemetry read raced with successful container removal after its measurement; the raw event and timing attribution are retained. Six separate namespace reads failed during Praxis route-scale crashes, limiting transition telemetry; API responses, pod diagnostics and route observers independently retain those outcomes. Resource windows include startup and warmup, and sampled peak memory is not exact peak RSS. [Resource report](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/08-resource-usage.md).

## Gateway API correctness and lifecycle

The retained extended-conformance campaign used the same product digests with upstream conformance v1.5.1. Both runnable releases passed all **33 selected HTTP core cases** each time. Across **107 selected cases**, agentgateway recorded **106/107**, while Praxis core v0.5.2 with operator fb8beaa recorded **52/107** in all three repetitions.

These are selected test cases, not percentages of the specification or official certification. Praxis also passed extensions including host/path rewriting, timeouts and WebSocket backend behavior. Agentgateway passed selected gRPC, TLSRoute, backend-TLS and ListenerSet cases that the tested Praxis pairing did not pass. Read the [exact case matrices](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-02-gateway-extended/README.md) before generalizing a failure to a whole capability.

Agentgateway's original `GatewayStaticAddresses` failure came from a stale-snapshot assertion in the older suite. Its release CI ran and passed the corrected test. Our separate GCP follow-up used conformance v1.6.1: agentgateway passed **3/3**, and Praxis failed **3/3** with `UnsupportedAddress`. The old 106/107 score stays unchanged. This focused test checks status/address assignment, not HTTP reachability through the assigned address.

For configuration scale, ClusterLoader2 submitted 1,000 or 5,000 hostname-bearing routes at 100 writes/second. Each route applied a generation marker through a response-header modifier. Completion required current-generation status and traffic verification through every hostname.

| Scenario | Agentgateway: completed runs | Mean completion, including submission | Praxis: completed runs |
| --- | ---: | ---: | ---: |
| Create 1,000 routes | 3/3 | 12.052 seconds | 0/3 |
| Update 1,000 routes | 3/3 | 11.669 seconds | 0/3 |
| Create 5,000 routes | 3/3 | 57.575 seconds | 0/3 |
| Update 5,000 routes | 3/3 | 57.150 seconds | 0/3 |

Praxis did not fully converge within 300 seconds after submission. Fresh pod diagnostics showed generated chains exceeding its compiled 100-filter guard. At 5,000 routes, the operator also exceeded Kubernetes's 1 MiB ConfigMap limit. These are constraints of this configuration representation and filter-bearing route shape, not a universal limit on bare routes.

Both gateways' controller restarts had no observed probe failures. Graceful data-plane deletion produced no observed failures for agentgateway and connection failures in each Praxis pass. However, probes reused connections, and draining/replacement processes overlapped. These short windows do not demonstrate complete handoff, fresh-connection availability, hard-failure recovery or zero downtime. [Full lifecycle report and limitations](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/03-gateway-api.md).

The stock operator paired with core nightly rejected generated cluster names containing `~` in all three setup attempts. Dependent Kubernetes cases are **not evaluated**, rather than zero throughput or individual feature failures. Standalone core nightly and the separately pinned AI nightly remain measured treatments.

## What to evaluate next

Use [requirements and evidence](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/requirements-index.md) to choose the relevant results. Praxis AI's stateful Responses/Conversations APIs, policy filters and optional llm-d integration are substantive capabilities outside these performance tests. Agentgateway also has endpoint-picker integration, but this campaign does not compare inference scheduling.

Before selecting production capacity, add your TLS, authentication, quota, telemetry, error and traffic requirements. Accounting accuracy, stateful resilience, MCP/A2A interoperability, longer soaks and independent placements need separate evaluations. The [source-supported feature comparison](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/04-feature-comparison.md) distinguishes those questions from measured behavior.

To reproduce the analysis without cloud resources, download the sanitized archives, verify their hashes and run the checked-in summarizers and renderers. To rerun the workloads, follow the pinned topology and qualification gates before accepting repetitions. The [methodology](https://github.com/danehans/agentgateway-benchmarks/tree/3dee941e72a881fbd0060726ee27c34b875df724/cpu-comparison/2026-10-05-stable-comparison/reports/05-methodology-and-validity.md) retains infrastructure corrections and exclusions; they are part of the result.
