Compare the performance of agentgateway in standalone mode versus a plain Kubernetes Service for inference routing.

In standalone request scheduler mode, agentgateway runs as a sidecar proxy
with the [Endpoint Picker Extension (EPP)](https://llm-d.ai/docs/architecture/core/router/epp) and communicates with it over localhost.
This benchmark runs that standalone configuration on Kubernetes, without a full
Gateway API stack.

For setup instructions, see the [inference benchmark README](https://github.com/agentgateway/benchmarks/blob/main/inference/README.md).

{{< reuse "agw-docs/pages/agentgateway/benchmarking/environment.md" >}}

## Results

{{< reuse "agw-docs/pages/agentgateway/benchmarking/results-notes.md" >}}

| Metric | Kubernetes Service | agentgateway standalone | Change vs. baseline |
| :--- | :--- | :--- | :--- |
| Peak output tokens/s | 6,910 | 16,178 | +134.1% |
| Achieved requests/s | 6.70 | 16.52 | +146.5% |
| TTFT p50 (s) | 62.9 | 0.1 | −99.8% |
| TTFT p90 (s) | 135.6 | 0.2 | −99.8% |
| ITL p50 (ms) | 30.3 | 52.7 | +73.7% |

### Token throughput

The charts show input, output, and total token throughput in tokens per second
across the tested request rates.

{{< benchmark-chart src="img/benchmarks/optimized-baseline-v0230-gateway-refresh-20260817/standalone/throughput_vs_qps.png" alt="Input, output, and total token throughput versus requested QPS for agentgateway standalone and the Kubernetes Service baseline." >}}

### Mean latency

The charts show mean TTFT, ITL, and NTPOT in milliseconds. The summary table
reports latency percentiles, with TTFT in seconds and ITL in milliseconds.

{{< benchmark-chart src="img/benchmarks/optimized-baseline-v0230-gateway-refresh-20260817/standalone/latency_vs_qps.png" alt="Mean TTFT, ITL, and NTPOT in milliseconds versus requested QPS for agentgateway standalone and the Kubernetes Service baseline." >}}

### Time to first token (p90)

The chart shows p90 TTFT in milliseconds while the tables report it in seconds.

{{< benchmark-chart src="img/benchmarks/optimized-baseline-v0230-gateway-refresh-20260817/standalone/ttft_p90_vs_qps.png" alt="Time to first token (p90) in milliseconds versus requested QPS for agentgateway standalone and the Kubernetes Service baseline." >}}

{{< reuse "agw-docs/pages/agentgateway/benchmarking/latency-caveat.md" >}}

{{< details title="Per-rate breakdown" >}}

Output throughput is in tokens/s (higher is better); TTFT is in seconds (lower
is better). `n/a` means the stage had no successful-request latency histogram.

| Requests/s | Kubernetes Service Output | agentgateway standalone Output | Kubernetes Service TTFT p50 | agentgateway standalone TTFT p50 | Kubernetes Service TTFT p90 | agentgateway standalone TTFT p90 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 1,570 | 1,694 | 0.5 | 0.1 | 0.5 | 0.1 |
| 10 | 5,113 | 4,723 | 0.5 | 0.1 | 1.0 | 0.2 |
| 15 | 4,634 | 6,480 | 0.6 | 0.1 | 1.8 | 0.2 |
| 20 | 6,182 | 10,974 | 2.5 | 0.2 | 36.0 | 0.3 |
| 22 | 6,255 | 11,831 | 3.9 | 0.1 | 36.8 | 0.1 |
| 25 | 6,044 | 12,227 | 6.7 | 0.1 | 41.2 | 0.1 |
| 30 | 6,296 | 12,923 | 7.0 | 0.1 | 42.6 | 0.1 |
| 35 | 6,145 | 13,032 | 7.6 | 0.1 | 45.2 | 0.1 |
| 40 | 6,910 | 15,964 | 78.0 | 0.1 | 124.5 | 0.2 |
| 43 | 6,858 | 15,781 | 80.2 | 0.1 | 129.2 | 0.2 |
| 46 | 6,800 | 15,566 | 65.3 | 0.2 | 132.0 | 0.2 |
| 49 | 6,780 | 15,834 | 55.1 | 0.1 | 131.3 | 0.2 |
| 52 | 6,893 | 16,031 | 72.0 | 0.1 | 133.6 | 0.2 |
| 55 | 6,865 | 15,766 | 56.4 | 0.1 | 133.6 | 0.2 |
| 57 | 6,840 | 15,829 | 55.2 | 0.1 | 134.3 | 0.2 |
| 60 | 6,879 | 16,178 | 62.9 | 0.1 | 135.6 | 0.2 |

{{< /details >}}

## Interpreting ITL

At a rate of 60 requests/s, agentgateway has higher p50 ITL (52.7 ms versus
30.3 ms for the Kubernetes Service), but higher throughput and lower time to
first token. Read ITL together with TTFT and throughput to assess this tradeoff.

{{< reuse "agw-docs/pages/agentgateway/benchmarking/methodology.md" >}}

## Evidence and reproduction

The [published report](https://github.com/agentgateway/benchmarks/blob/main/inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817/service-vs-agentgateway-standalone/README.md),
charts, and tables on this page come from campaign `optimized-baseline-v0230-gateway-refresh-20260817`.

- [Normalized metrics (CSV)](https://github.com/agentgateway/benchmarks/blob/main/inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817/service-vs-agentgateway-standalone/metrics.csv)
- [Campaign manifest](https://github.com/agentgateway/benchmarks/blob/main/inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817/campaign-manifest.yaml)
- [Campaign provenance](https://github.com/agentgateway/benchmarks/blob/main/inference/reports/llm-d-benchmark/optimized-baseline-qwen3-32b-h100/optimized-baseline-v0230-gateway-refresh-20260817/campaign-provenance.yaml)
- [Benchmark runner and reproduction instructions](https://github.com/agentgateway/benchmarks/blob/main/inference/README.md)

Use the campaign manifest's versions and configuration when reproducing these
results.
