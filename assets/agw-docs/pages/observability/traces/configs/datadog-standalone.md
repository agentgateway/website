[Datadog](https://www.datadoghq.com/) collects metrics and OpenTelemetry traces
from {{< reuse "agw-docs/snippets/agentgateway.md" >}}. Choose the setup that
matches what you want to observe.

| Setup | Telemetry | When to use |
| --- | --- | --- |
| Complete example | Proxy metrics, LLM traces, and a dashboard | Evaluate the integration end to end or use the example as a production reference |
| Direct trace export | LLM traces | Add tracing to an existing deployment with the fewest components |

The complete example is the recommended starting point. The example runs the Datadog
Agent and a demo model with Docker Compose next to your {{< reuse "agw-docs/snippets/agentgateway.md" >}}
installation. The Agent scrapes proxy metrics and receives OpenTelemetry
Protocol (OTLP) traces over HTTP directly from the proxy. The direct setup sends
traces from the proxy to Datadog's hosted OTLP endpoint.

## Before you begin

For the complete example, you need:

- A running {{< reuse "agw-docs/snippets/agentgateway.md" >}} installation on the Docker host, with metrics
  on the default port `15020`. To install {{< reuse "agw-docs/snippets/agentgateway.md" >}}, see
  [Install]({{< link-hextra path="/documentation/setup/install/" >}}).
- [Docker](https://docs.docker.com/get-started/get-docker/) with
  [Docker Compose](https://docs.docker.com/compose/install/) v2, and `curl`.
- Free loopback ports `3000` for the {{< reuse "agw-docs/snippets/agentgateway.md" >}} LLM listener, `18080` for the
  demo model, and `4318` for OTLP ingestion.
- A Datadog organization, API key, and the correct
  [Datadog site](https://docs.datadoghq.com/getting_started/site/).
- Agent Observability enabled in your Datadog organization to view LLM traces.

The direct setup requires a running {{< reuse "agw-docs/snippets/agentgateway.md" >}}
installation and a Datadog API key. If you have not installed
{{< reuse "agw-docs/snippets/agentgateway.md" >}} or configured an LLM provider,
complete the [LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}})
first.

## Run the complete example

The
[Datadog standalone example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog/standalone)
uses Docker Compose to run the Datadog Agent and the HomeHub demo model. HomeHub
returns fixed OpenAI-compatible responses, so the example does not call a paid
model or need a provider API key. You merge the example's `config.yaml` into
your {{< reuse "agw-docs/snippets/agentgateway.md" >}} configuration to add the demo model and trace export.
Traces from the example omit prompt and completion content.

> [!NOTE]
> The example pins the Datadog Agent and HomeHub versions in `versions.env`.
> The example files expect {{< reuse "agw-docs/snippets/agentgateway.md" >}} to run on the Docker host. For
> a container or remote gateway, update the backend addresses in `config.yaml`
> and the metrics endpoint in `openmetrics.yaml`. Check the example README for
> the tested {{< reuse "agw-docs/snippets/agentgateway.md" >}} version.

1. Clone the {{< reuse "agw-docs/snippets/agentgateway.md" >}} repository and
   change to the example directory.

   ```sh
   git clone https://github.com/agentgateway/agentgateway.git
   cd agentgateway/examples/datadog/standalone
   ```

2. Create a `.env` file for your Datadog credentials. The repository's
   `.gitignore` already excludes this file.

   ```dotenv
   DD_API_KEY=replace-with-your-datadog-api-key
   DD_SITE=us3.datadoghq.com
   ```

   > [!NOTE]
   > Datadog API keys and application keys are different. This example requires
   > an API key to send telemetry to Datadog.

3. Restrict the `.env` file permissions to your user.

   ```sh
   chmod 600 .env
   ```

4. Start the Datadog Agent and HomeHub. The example's `openmetrics.yaml` check
   sets `use_latest_spec: true` so that the Agent parses the proxy's output as
   OpenMetrics. {{< reuse "agw-docs/snippets/agentgateway.md" >}} 1.6 and earlier need this setting, or the Agent
   drops every counter.

   ```sh
   docker compose --env-file versions.env --env-file .env up -d
   ```

5. Merge the example's
   [`config.yaml`](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/standalone/config.yaml)
   into your {{< reuse "agw-docs/snippets/agentgateway.md" >}} configuration. The file adds the `homehub-support`
   model on port `3000` and exports traces to the Agent at `localhost:4318`.
   To match your deployment, adjust the port and backend addresses.

   ```yaml
   # yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
   frontendPolicies:
     tracing:
       host: localhost:4318
       protocol: http
       randomSampling: true
       attributes:
         env: '"datadog-dev"'
   llm:
     port: 3000
     models:
     - name: homehub-support
       provider: openAI
       params:
         baseUrl: http://localhost:18080/v1
   ```

   For more information, see
   [Update the configuration]({{< link-hextra path="/documentation/setup/update/" >}}).

6. Send a request to the HomeHub model.

   ```sh
   curl --fail http://127.0.0.1:3000/v1/chat/completions \
     -H 'Content-Type: application/json' \
     -d '{"model":"homehub-support","stream":false,"messages":[{"role":"user","content":"How do I factory-reset my HomeHub X2?"}],"max_tokens":96}'
   ```

   The response describes the HomeHub X2 reset procedure and reports 12 input
   and 24 output tokens.

7. Check the proxy's request and token metrics.

   ```sh
   curl --fail http://127.0.0.1:15020/metrics \
     | grep -E '^agentgateway_(requests|gen_ai_client_token_usage)'
   ```

   The output includes `agentgateway_requests_total` and
   `agentgateway_gen_ai_client_token_usage` samples for the `homehub-support`
   model.

8. Run the OpenMetrics check twice, and send another request between the two
   runs. Counter metrics need two scrapes before rate samples appear.

   ```sh
   docker compose --env-file versions.env --env-file .env \
     exec datadog agent check openmetrics --check-rate
   ```

   The check reports metric samples tagged `component:proxy`.

9. In Datadog, open **Metrics > Explorer**, filter by `env:datadog-dev`, and
   search for an exact metric name.

   - `agentgateway.requests.count`
   - `agentgateway.gen_ai.token.usage.sum`

10. In **Dashboards**, import the example's
    [`dashboard.json`](https://github.com/agentgateway/agentgateway/blob/main/examples/datadog/dashboard.json)
    and set the `env` template variable to `datadog-dev`. Enable percentile
    aggregations in Metrics Summary for the latency distributions before you use
    the p95 widgets. The controller widgets stay empty in standalone mode. The
    streaming timing, MCP, and guardrail widgets stay empty until the
    corresponding traffic is present. HomeHub has no real provider pricing, so
    estimated-cost widgets can be empty or show **Cost unavailable**.

Review redaction, sampling, access controls, and custom-metric cardinality
before you adapt the example for production.

## Configure direct trace export

Use this smaller setup when you only need traces and do not want to run the
Datadog Agent locally. Replace the API key and change the host for your Datadog
site if needed.

{{< tabs >}}
{{% tab name="Binary and Docker" %}}

Add this tracing policy to your `config.yaml`.

```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
docker compose --env-file versions.env --env-file .env ps
docker compose --env-file versions.env --env-file .env \
  exec datadog agent status
```

Do not share `docker compose config`, container inspection output, or the local
`.env` file. These outputs can contain credentials.

### Metrics are missing

A healthy `agentgateway.openmetrics.health` service check means that the
endpoint responded. The service check does not prove that counter samples
reached Datadog.
Run traffic between scrape intervals, repeat the check with `--check-rate`,
allow several minutes for indexing, and search by the exact metric name.

### Gauges appear but counters are missing

In {{< reuse "agw-docs/snippets/agentgateway.md" >}} 1.6 and earlier, confirm that the `openmetrics` check
sets `use_latest_spec: true`. Without this setting, the Agent parses the proxy's
OpenMetrics output as classic Prometheus text. The Agent then drops every counter
without an error, but gauges and histograms still arrive.

### Traces are missing

Confirm that Agent Observability is enabled, the Agent is healthy, and
`DD_SITE` selects the correct organization. Search for `ml_app:agentgateway`
and allow several minutes for processing. Confirm that your
{{< reuse "agw-docs/snippets/agentgateway.md" >}} configuration includes the example's tracing settings
and that port `4318` on the Docker host reaches the Agent.

### Dashboard percentile widgets are empty

Enable percentile aggregations for the corresponding distribution metrics in
Datadog Metrics Summary, allow time for processing, and confirm that more than
one scrape occurred.

## Cleanup

1. Remove the HomeHub model and tracing settings that you merged into your
   {{< reuse "agw-docs/snippets/agentgateway.md" >}} configuration.

2. Stop the Datadog Agent and HomeHub.

   ```sh
   docker compose --env-file versions.env --env-file .env down
   ```

## Learn more

- [Observability overview]({{< link-hextra path="/documentation/observability/" >}})
- [Observe LLM traffic]({{< link-hextra path="/documentation/llm/observability/" >}})
- [LLM observability integrations]({{< link-hextra path="/integrations/llm/observability/" >}})
- [Complete Datadog example](https://github.com/agentgateway/agentgateway/tree/main/examples/datadog)
- [Datadog OpenMetrics](https://docs.datadoghq.com/integrations/openmetrics/)
- [Agent Observability with OpenTelemetry](https://docs.datadoghq.com/llm_observability/instrument/otel_instrumentation/)
- [Datadog OTLP endpoint](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)
