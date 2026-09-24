Peak output throughput is the maximum number of tokens-per-second across the tested request rates.
All other summary metrics are at a rate of 60 requests-per-second.
See [Metric definitions](#methodology-and-metric-definitions) for more detail.

Higher throughput and lower latency are better. A positive percentage indicates
an increase, which is favorable for throughput but unfavorable for latency.

At 10 requests/s, the Service baseline has slightly higher output throughput;
both agentgateway modes pull ahead at 15 requests/s, and the baseline's TTFT
rises sharply at 20 requests/s as its throughput begins to plateau. The large
TTFT reductions at 60 requests/s therefore describe performance against an
overloaded baseline, rather than a uniform improvement across all loads.
