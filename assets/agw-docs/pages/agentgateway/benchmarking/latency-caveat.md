{{< callout type="warning" >}}
Interpret latency together with failures. Under overload, slower requests can
time out and be excluded from successful-request latency distributions, making
latency look deceptively low. Consult the `failures`, `requests`, and
`failure_rate` columns in the linked metrics CSV. Each treatment has only one
repetition, so these results do not quantify run-to-run variability.
{{< /callout >}}
