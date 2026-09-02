[Datadog](https://www.datadoghq.com/) collects metrics and OpenTelemetry traces
from agentgateway. Choose the setup that matches what you want to observe.

| Setup | Telemetry | When to use it |
| --- | --- | --- |
| Complete example | Proxy metrics, LLM traces, and a dashboard | Evaluate the integration end to end or use it as a production reference |
| Direct trace export | LLM traces | Add tracing to an existing deployment with the fewest components |

The complete example is the recommended starting point. It runs the Datadog
Agent and OpenTelemetry Collector locally with Docker Compose. The direct setup
sends traces from agentgateway to Datadog's hosted OTLP endpoint.

## Before you begin

For the complete example, you need:

- [Docker](https://docs.docker.com/get-docker/) with
  [Docker Compose](https://docs.docker.com/compose/install/).
- [uv](https://docs.astral.sh/uv/) and `curl`.
- A Datadog organization, API key, and the correct
  [Datadog site](https://docs.datadoghq.com/getting_started/site/) to export
  telemetry. Local validation does not require a Datadog account.
- Agent Observability enabled in your Datadog organization to view LLM traces.

The direct setup requires a running agentgateway installation and a Datadog API
key. If you have not installed agentgateway or configured an LLM provider,
complete the [LLM quickstart]({{< link-hextra path="/quickstart/llm/" >}})
first.

## Run the complete example

The
[Datadog standalone example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog/standalone)
supports two modes. The base `compose.yaml` file runs agentgateway, a synthetic
OpenAI-compatible provider, and an OpenTelemetry Collector for local validation.
It does not send telemetry to Datadog. Adding `compose.datadog.yaml` starts the
Datadog Agent and exports the synthetic metrics and traces to your Datadog
organization. Both modes use the synthetic provider and do not call a paid
model.

1. Clone the agentgateway repository and change to the example directory.

   ```sh
   git clone https://github.com/agentgateway/agentgateway.git
   cd agentgateway/examples/datadog/standalone
   ```

2. Validate the gateway, fixture, metrics, and trace export locally.

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

   {{< callout type="info" >}}
   Datadog API keys and application keys are different. This example requires
   an API key to ingest telemetry.
   {{< /callout >}}

5. Start the same services with the Datadog export override, generate traffic,
   and perform successive OpenMetrics checks.

   ```sh
   docker compose -f compose.yaml -f compose.datadog.yaml up -d
   uv run ../smoke.py --datadog
   docker compose -f compose.yaml -f compose.datadog.yaml \
     exec datadog agent check openmetrics --check-rate
   ```

The first counter scrape establishes a baseline. Repeat the smoke test across
scrape intervals when populating rate charts.

By default, the example exports metadata-only traces and uses the synthetic
`datadog-test` model. Its README also documents explicit options to capture
synthetic prompts and completions or send a paid request to a real OpenAI model.
Review redaction, sampling, access controls, and custom-metric cardinality
before adapting the example for production.

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

Add this tracing policy to your agentgateway `values.yaml`.

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
configure OpenMetrics collection, a dashboard, or the v1.5.0 trace compatibility
processor included in the complete example. Keep API keys out of source control.

{{< reuse "agw-docs/pages/observability/traces/configs/datadog-verify.md" >}}

## Troubleshooting

### The Datadog Agent container is unhealthy

An invalid API key or incorrect `DD_SITE` can make the Agent unhealthy even
when its OpenMetrics check reaches agentgateway. Verify the site and API key,
then inspect the Agent.

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
configuration exports traces to the local fixture; include
`compose.datadog.yaml` to export them to Datadog.

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

- [Complete Datadog example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog)
- [Datadog OpenMetrics](https://docs.datadoghq.com/integrations/openmetrics/)
- [Agent Observability with OpenTelemetry](https://docs.datadoghq.com/llm_observability/instrument/otel_instrumentation/)
- [Datadog OTLP endpoint](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)
