## Test environment

This {{< gloss "Benchmark campaign" >}}campaign{{< /gloss >}} compares EPP-based agentgateway routing with a plain Kubernetes Service across eight vLLM model servers. It uses no [EPP](https://llm-d.ai/docs/architecture/core/router#llm-d-endpoint-picker-epp) or [scoring](https://llm-d.ai/docs/architecture/core/router/epp/configuration#plugins) to route inference requests to a model server endpoint.

The `optimized-baseline-qwen3-32b-h100-v0.9` [reference profile](https://github.com/agentgateway/benchmarks/blob/main/inference/suites/llm-d-benchmark/references/optimized-baseline-qwen3-32b-h100-v0.9.yaml) is used for the campaign,
based on llm-d's [Optimized Baseline](https://llm-d.ai/docs/well-lit-paths/foundations/optimized-baseline).
The agentgateway {{< gloss "Benchmark treatment" >}}treatments{{< /gloss >}} use approximate prefix-cache affinity and token-load
scoring to select model-server endpoints.

If you are interested in benchmarks for other llm-d [well-lit paths](https://llm-d.ai/docs/well-lit-paths)
or inference topologies, [create an issue](https://github.com/agentgateway/benchmarks/issues)
that explains your use case.

**Prefill/decode (P/D) disaggregation is not used.** Each vLLM replica handles both
prefill and decode. The [comparison configuration](https://github.com/agentgateway/benchmarks/blob/main/inference/suites/llm-d-benchmark/scenarios/defaults/agentgateway-comparison.yaml)
disables separate prefill replicas and the P/D routing sidecar, so all treatments
use the same model-server topology. These results compare routing within that
topology, rather than measuring the effects of P/D disaggregation.

The table summarizes the published campaign. See the [campaign manifest](https://github.com/agentgateway/benchmarks/blob/main/inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817/campaign-manifest.yaml)
for configuration details and the [campaign provenance](https://github.com/agentgateway/benchmarks/blob/main/inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817/campaign-provenance.yaml)
for execution times and shared configuration hashes.

| Setting | Value |
| --- | --- |
| Cluster provider | `gke` (Google Kubernetes Engine) |
| Accelerator type and model | NVIDIA H100 GPU (`gpu`, `h100`) |
| Total accelerators | 16 GPUs (8 replicas × 2 GPUs per replica) |
| Backend type | `vllm` |
| Model | `Qwen/Qwen3-32B` |

{{< callout type="info" >}}
These are published results for agentgateway **v1.4.1**, regardless of the docs
version selected.
{{< /callout >}}

### Workload

The [workload configuration](https://github.com/agentgateway/benchmarks/blob/main/inference/suites/llm-d-benchmark/workloads/upstream-optimized-baseline.yaml.in)
uses streaming completion requests with the following settings:

- **Arrival pattern:** Randomized (Poisson).
- **Request timeout:** 300 seconds.
- **Shared-prefix groups:** 150 groups with five prompts per group.
- **Prompt lengths:** 6,000 tokens for the shared system prompt and 1,200 tokens for the user prompt.
- **Target output length:** 1,000 tokens.
- **Multi-turn chat:** Disabled.
- **Requested rates:** 3–60 requests/s across the measured stages, after warm-up.
