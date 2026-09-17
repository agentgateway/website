## Methodology and metric definitions

Each treatment ran independently with the same workload and model-server
topology. The provenance records the execution times and shared configuration
hashes. These reports compare each agentgateway deployment mode with the Kubernetes Service baseline.

- **Requested rate (QPS)** is the load offered by the generator.
- **Requests/s** is the achieved request throughput, which can be lower under load.
- **Output tokens/s** measures output throughput; higher is better. The summary
  reports each treatment's peak across the tested request rates.
- **TTFT** (time to first token) includes waiting for the first response token;
  lower is better. p50 is the median, and p90 is the 90th percentile.
- **ITL** (inter-token latency) measures token cadence after the first token;
  lower is better, but it must be considered together with TTFT and throughput.
- **NTPOT** (normalized time per output token), used in the latency chart, is
  end-to-end latency divided by output tokens.

Warm-up stages whose requested rate repeats in the measured ladder are excluded.
Missing successful-request latency histograms appear as `n/a` and are omitted
from latency lines.
