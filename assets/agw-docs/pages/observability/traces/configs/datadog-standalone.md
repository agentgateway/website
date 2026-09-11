[Datadog](https://www.datadoghq.com/) collects metrics and OpenTelemetry traces
from {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Choose the setup that
matches what you want to observe.

| Setup | Telemetry | When to use it |
| --- | --- | --- |
| Complete example | Proxy metrics, LLM traces, and a dashboard | Evaluate the integration end to end or use it as a production reference |
| Direct trace export | LLM traces | Add tracing to an existing deployment with the fewest components |

The complete example is the recommended starting point. It runs the Datadog
Agent and OpenTelemetry Collector locally with Docker Compose. The direct setup
sends traces from {{< reuse "agw-docs/snippets/agentgateway.md" >}} to Datadog's hosted OTLP
endpoint.

## Before you begin

For the complete example, you need:

- [Docker](https://docs.docker.com/get-docker/) with
  [Docker Compose](https://docs.docker.com/compose/install/).
- [uv](https://docs.astral.sh/uv/) and `curl`.
- Free loopback ports `13000`, `18080`, and `18520`.
- A Datadog organization, API key, and the correct
  [Datadog site](https://docs.datadoghq.com/getting_started/site/) to export
  telemetry.
- Agent Observability enabled in your Datadog organization to view LLM traces.

The first three steps of the example validate the gateway locally and need no
Datadog account. The remaining steps export telemetry, so they do.

The direct setup requires a running {{< reuse "agw-docs/snippets/agentgateway.md" >}}
installation and a Datadog API key. If you have not installed
{{< reuse "agw-docs/snippets/agentgateway.md" >}} or configured an LLM provider,
complete the [LLM quickstart]({{< link-hextra path="/quickstart/llm/" >}})
first.

## Run the complete example

The
[Datadog standalone example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog/standalone)
supports two modes. The base `compose.yaml` file runs {{< reuse "agw-docs/snippets/agentgateway.md" >}},
a synthetic OpenAI-compatible provider, and an OpenTelemetry Collector for
local validation.
It does not send telemetry to Datadog. Adding `compose.datadog.yaml` starts the
Datadog Agent and exports the synthetic metrics and traces to your Datadog
organization. Both modes use the synthetic provider and do not call a paid
model.

> [!NOTE]
> The example pins the {{< reuse "agw-docs/snippets/agentgateway.md" >}} and
> Datadog Agent versions it was tested against, and its OpenTelemetry Collector
> configuration includes workarounds for that release. Check the example README
> for the pinned versions before you run it against a newer release.

1. Clone the {{< reuse "agw-docs/snippets/agentgateway.md" >}} repository and
   change to the example directory.

   ```sh
   git clone https://github.com/agentgateway/agentgateway.git
   cd agentgateway/examples/datadog/standalone
   ```

2. Validate the gateway, synthetic provider, metrics, and trace export locally.

   ```sh
   docker compose up -d
   uv run ../smoke.py
   ```

3. Inspect the raw Prometheus metrics exposed by the proxy.

   ```sh
   curl http://127.0.0.1:18520/metrics
   ```

4. Create an ignored `.env` file for your Datadog credentials.

   ```dotenv
   DD_API_KEY=replace-with-your-datadog-api-key
   DD_SITE=us3.datadoghq.com
   ```

   Protect the file with `chmod 600 .env`.

   > [!NOTE]
   > Datadog API keys and application keys are different. This example requires
   > an API key to ingest telemetry.

5. Start the same services with the Datadog export override, generate traffic,
   and perform successive OpenMetrics checks.

   ```sh
   docker compose -f compose.yaml -f compose.datadog.yaml up -d
   uv run ../smoke.py --datadog
   docker compose -f compose.yaml -f compose.datadog.yaml \
     exec datadog agent check openmetrics --check-rate
   ```

   The first counter scrape establishes a baseline. Repeat the smoke test
   across scrape intervals when populating rate charts.

6. In Datadog, open **Metrics > Explorer**, filter by `env:datadog-dev`, and
   search for an exact metric name.

   - `agentgateway.requests.count`
   - `agentgateway.gen_ai.token.usage.sum`
   - `agentgateway.gen_ai.cost.usd.count`

7. In **Dashboards**, import the example's
   [`dashboard.json`](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/dashboard.json)
   and set the `env` template variable to `datadog-dev`. Enable percentile
   aggregations in Metrics Summary for the latency distributions before you use
   the p95 widgets. Controller, MCP, and guardrail widgets remain empty until
   their corresponding components or traffic are present.

The example uses the synthetic `datadog-test` model, which is not in Datadog's
pricing catalog, so Datadog displays **Cost unavailable**. The cost calculated
from the synthetic provider's rates is still in the span's
`agw.ai.usage.cost.*` attributes and the
`agentgateway.gen_ai.cost.usd.count` metric. The
[README](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/standalone/README.md)
explains how to send a request to a real OpenAI model and compare the two
estimates, and how to capture synthetic prompts and completions.

By default, the example exports metadata-only traces. Review redaction,
sampling, access controls, and custom-metric cardinality before adapting the
example for production.

## Configure direct trace export

Use this smaller setup when you only need traces and do not want to run the
Datadog Agent locally. Replace the API key and change the host for your Datadog
site if needed.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add this tracing policy to your `config.yaml`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: otlp.datadoghq.com:443
    protocol: grpc
    randomSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          DD-API-KEY: "<your-datadog-api-key>"
```

{{% /tab %}}
{{% tab name="Kubernetes (Helm)" %}}

Add this tracing policy to your {{< reuse "agw-docs/snippets/agentgateway.md" >}}
`values.yaml`.

```yaml
config:
  frontendPolicies:
    tracing:
      host: otlp.datadoghq.com:443
      protocol: grpc
      randomSampling: true
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            DD-API-KEY: "<your-datadog-api-key>"
```

Apply the change.

{{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

{{% /tab %}}
{{< /tabs >}}

For the EU region, use `otlp.datadoghq.eu:443`. This direct path does not
configure OpenMetrics collection or a dashboard.

> [!NOTE]
> Keep API keys out of source control.

{{< reuse "agw-docs/pages/observability/traces/configs/datadog-verify.md" >}}

## Troubleshooting

### The Datadog Agent container is unhealthy

An invalid API key or incorrect `DD_SITE` can make the Agent unhealthy even
when its OpenMetrics check reaches {{< reuse "agw-docs/snippets/agentgateway.md" >}}.
Verify the site and API key, then inspect the Agent.

```sh
docker compose -f compose.yaml -f compose.datadog.yaml ps
docker compose -f compose.yaml -f compose.datadog.yaml \
  exec datadog agent status
```

Do not share `docker compose config`, container inspection output, or the local
`.env` file; those outputs can contain credentials.

### Metrics are missing

A healthy `agentgateway.openmetrics.health` service check proves that the
endpoint responded; it does not prove that counter samples reached Datadog.
Run traffic between scrape intervals, repeat the check with `--check-rate`,
allow several minutes for indexing, and search by the exact metric name.

### Traces are missing

Confirm that Agent Observability is enabled, the Agent is healthy, and
`DD_SITE` selects the correct organization. Search for `ml_app:agentgateway`
and allow several minutes for processing. The default Docker Compose
configuration exports traces to the synthetic provider's local trace-capture
endpoint; include `compose.datadog.yaml` to export them to Datadog.

### Dashboard percentile widgets are empty

Enable percentile aggregations for the corresponding distribution metrics in
Datadog Metrics Summary, allow time for processing, and confirm that more than
one scrape occurred.

## Cleanup

Stop the Datadog export configuration when you finish.

```sh
docker compose -f compose.yaml -f compose.datadog.yaml down
```

To return to local trace capture, start the default Docker Compose configuration
without the Datadog override.

## Learn more

- [Observability overview]({{< link-hextra path="/observability/" >}})
- [Observe LLM traffic]({{< link-hextra path="/llm/observability/" >}})
- [LLM observability integrations]({{< link-hextra path="/integrations/llm-observability/" >}})
- [Complete Datadog example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog)
- [Datadog OpenMetrics](https://docs.datadoghq.com/integrations/openmetrics/)
- [Agent Observability with OpenTelemetry](https://docs.datadoghq.com/llm_observability/instrument/otel_instrumentation/)
- [Datadog OTLP endpoint](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)
