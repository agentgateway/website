[Honeycomb](https://www.honeycomb.io/) is an observability platform that accepts OpenTelemetry traces, logs, and metrics. Agentgateway can export traces and access logs directly to Honeycomb over OpenTelemetry Protocol (OTLP) HTTP. An OpenTelemetry Collector scrapes the agentgateway Prometheus endpoint and forwards metrics to Honeycomb.

## Before you begin

1. [Complete the LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}}).
2. Install Docker if you want to export metrics.
3. Sign up for a [Honeycomb account](https://ui.honeycomb.io/signup). You need the Team Owner role to create an Ingest API key.

## Create a Honeycomb Ingest key

Honeycomb authenticates OTLP exports with an Environment Ingest key in the `x-honeycomb-team` header. Create the key in the Environment that should store agentgateway telemetry, and allow it to create datasets.

1. Log in to the [Honeycomb UI](https://ui.honeycomb.io/).
2. Select the Environments selector in the navigation menu, then select **Manage Environments**.
3. Select the Environment that should receive agentgateway telemetry.
4. Select **API Keys**, then select the **Ingest** view.
5. Select **Create Ingest API Key**.
6. Name the key, and enable **Can create services/datasets**. Honeycomb creates a dataset the first time telemetry arrives for a `service.name` that does not already exist. This permission is permanent. To change it, delete the key and create a new one.
7. Select **Create**, and copy the Ingest key immediately. When you create the key in the UI, Honeycomb shows the complete value once. That value is the Key ID and the secret concatenated, with no separator. Store it outside source control.

   If you create the key with the [Key Management API](https://docs.honeycomb.io/api/key-management/create-an-api-key/), concatenate `data.id` and `data.attributes.secret` yourself, with no separator, and send that string as `x-honeycomb-team`.

8. Save the key and the Honeycomb API hostname in environment variables.

   ```sh
   export HONEYCOMB_API_KEY="<your-ingest-key>"
   export HONEYCOMB_ENDPOINT="api.honeycomb.io"
   export HONEYCOMB_METRICS_DATASET="agentgateway-metrics"
   ```

   `HONEYCOMB_ENDPOINT` is the hostname only, with no scheme such as `https://` and no path. The example uses the US endpoint. For the EU instance, set `HONEYCOMB_ENDPOINT` to `api.eu1.honeycomb.io`. `HONEYCOMB_METRICS_DATASET` is the dataset name sent on the metrics export. See [Export metrics](#export-metrics) for where that data appears.

> [!IMPORTANT]
> Agentgateway resolves `${...}` references in the configuration file from its own environment when the process starts, and it exits with an error if a referenced variable is unset. Export these variables in the same terminal that you start agentgateway from, or set them another way, such as in a systemd unit or a Docker `--env-file`.

## Export traces and access logs

Add the following `frontendPolicies` section to your agentgateway configuration. Both exporters send the Ingest key in `x-honeycomb-team`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: ${HONEYCOMB_ENDPOINT}:443
    protocol: http
    randomSampling: true
    clientSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          x-honeycomb-team: ${HONEYCOMB_API_KEY}
    resources:
      service.name: '"agentgateway"'
    attributes:
      llm.input_messages: >-
        flattenRecursive(llm.prompt.map(c, {"message": c}))
      llm.output_messages: >-
        flattenRecursive(llm.completion.map(c, {
          "role": "assistant",
          "content": c
        }))
  accessLog:
    otlp:
      host: ${HONEYCOMB_ENDPOINT}:443
      protocol: http
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            x-honeycomb-team: ${HONEYCOMB_API_KEY}
      fields:
        add:
          llm.input_messages: >-
            flattenRecursive(llm.prompt.map(c, {"message": c}))
          llm.output_messages: >-
            flattenRecursive(llm.completion.map(c, {
              "role": "assistant",
              "content": c
            }))
```

Review the following fields before you start agentgateway.

| Field | Description |
|-------|-------------|
| `host` | Honeycomb API hostname and port, in `hostname:port` format. Honeycomb accepts OTLP/HTTP on port `443`. |
| `protocol` | OTLP protocol variant. Set this field to `http`. Honeycomb accepts OTLP over HTTP at `/v1/traces` and `/v1/logs`. |
| `randomSampling` | Determines how often agentgateway starts a new trace. The value `true` traces every request, which is useful while you verify the integration. Lower this value for production traffic. |
| `clientSampling` | Determines whether agentgateway honors a sampling decision that the client sends. |
| `policies.backendTLS` | Enables TLS for the connection to Honeycomb. An empty object uses the default settings. |
| `policies.requestHeaderModifier.set` | Headers that agentgateway sends with each export request. Honeycomb requires `x-honeycomb-team`. |
| `resources` | Resource attributes that apply to every exported span. Each value is a Common Expression Language (CEL) expression, so a literal string is quoted twice. Honeycomb names the trace dataset from `service.name`. This example uses `agentgateway`. |
| `attributes` and `fields.add` | Extra key-value pairs to include in each span or access log entry. Each value is a CEL expression. |

Neither exporter sets a `path` field, so agentgateway uses the default OTLP/HTTP paths, `/v1/traces` for traces and `/v1/logs` for access logs. Honeycomb expects both of these paths. For the signal-specific URLs, see [Honeycomb's OpenTelemetry endpoint reference](https://docs.honeycomb.io/send-data/opentelemetry/).

Leave `OTEL_SERVICE_NAME` unset. Access logs then use the resource name `agentgateway`, which matches `tracing.resources`. Honeycomb stores the logs in that same dataset. When a log record includes `service.name`, Honeycomb uses that value as the dataset name and ignores `x-honeycomb-dataset`.

The `llm.input_messages` and `llm.output_messages` attributes export the prompt and the completion. Reading `llm.prompt` and `llm.completion` causes agentgateway to inspect the request and response bodies, so omit these attributes if you do not want to export message content.

Honeycomb Classic still requires `x-honeycomb-dataset` on the trace export. Add it beside `x-honeycomb-team` when your team uses Classic. Current Environments name the trace dataset from `service.name`.

## Export metrics

Agentgateway exposes Prometheus metrics on port `15020`. Run an OpenTelemetry Collector that scrapes this endpoint and exports the metrics to Honeycomb over OTLP/HTTP.

Honeycomb's Collector example sends `x-honeycomb-dataset` on the metrics pipeline. Legacy metrics environments store those metrics in the named dataset. When the header is absent, legacy metrics land in `unknown_metrics`. Environments on the current metrics experience store metrics in a managed dataset named `Metrics` and ignore the header. The configuration below sends the header so both experiences accept the export.

1. Create an `otel-collector-config.yaml` file.

   ```yaml
   receivers:
     prometheus/agentgateway:
       config:
         scrape_configs:
         - job_name: agentgateway
           scrape_interval: 10s
           static_configs:
           - targets:
             - host.docker.internal:15020

   processors:
     memory_limiter:
       check_interval: 1s
       limit_mib: 256
     batch: {}

   exporters:
     otlphttp/honeycomb:
       endpoint: https://${env:HONEYCOMB_ENDPOINT}:443
       headers:
         x-honeycomb-team: ${env:HONEYCOMB_API_KEY}
         x-honeycomb-dataset: ${env:HONEYCOMB_METRICS_DATASET}

   service:
     pipelines:
       metrics:
         receivers: [prometheus/agentgateway]
         processors: [memory_limiter, batch]
         exporters: [otlphttp/honeycomb]
   ```

   The `${env:...}` references stay in the file, and the collector resolves them from its own environment at startup. The next step passes the variables into the container. The Collector exporter type is `otlphttp`. Honeycomb documents this exporter as OTLP over HTTP, with the endpoint `https://api.honeycomb.io:443` for the US instance.

2. Start the OpenTelemetry Collector. The `host-gateway` entry lets the container scrape the agentgateway process that runs on the host.

   ```sh
   docker run --rm --name honeycomb-metrics-collector \
     --add-host=host.docker.internal:host-gateway \
     -v "$PWD/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml:ro" \
     -e HONEYCOMB_ENDPOINT \
     -e HONEYCOMB_API_KEY \
     -e HONEYCOMB_METRICS_DATASET \
     otel/opentelemetry-collector-contrib:0.128.0
   ```

For production deployments, review the collector's resource limits, batching, and deployment model for your expected telemetry volume. Honeycomb documents a 15 MB request size limit for OTLP exports.

## Optional: Add resource attributes

Add resource attributes to `frontendPolicies.tracing.resources` to help filter traces in Honeycomb. Resource values are static CEL expressions that apply to every exported span. Honeycomb uses `service.name` as the trace dataset name, so keep that value stable after data starts arriving.

```yaml
frontendPolicies:
  tracing:
    host: ${HONEYCOMB_ENDPOINT}:443
    resources:
      service.name: '"agentgateway"'
      deployment.environment.name: '"production"'
      service.version: '"2.1.0"'
```

For per-request values such as the selected model, use span attributes instead of a static resource attribute. For more information, see [Add span and resource attributes]({{< link-hextra path="/documentation/observability/traces/setup/#add-attributes" >}}).

## Verify the integration

<!-- TODO: Add verified Honeycomb UI screenshots of an agentgateway trace waterfall and a metrics query. This docs environment had no Honeycomb Ingest key, so the UI was not captured. -->

1. Start agentgateway with the updated configuration, in a terminal where the `HONEYCOMB_*` variables are exported.
2. Send an LLM request through agentgateway. The following example assumes that agentgateway runs locally on port `4000` and that you configured an OpenAI-compatible provider and the `gpt-3.5-turbo` model.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'content-type: application/json' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Reply with exactly: Honeycomb observability works"
         }
       ]
     }'
   ```

3. Find the request in the agentgateway logs and copy its `trace.id` value. A successful request resembles the following example.

   ```text
   info request gateway=default/default route=internal/llm:request http.status=200 trace.id=4d50f6d1cb4099a1a22e50b6d339d5f2 span.id=a3f2ae9119406264 protocol=llm gen_ai.provider.name=openai
   ```

4. In Honeycomb, open the Environment that owns the Ingest key, then open the `agentgateway` dataset. From the left sidebar, select **New Query**. In Query Builder, filter on the trace ID you copied, for example `trace.trace_id = 4d50f6d1cb4099a1a22e50b6d339d5f2`. Select **Run Query**. In the results, select the `trace.trace_id` value to open the trace waterfall.
5. In the same dataset, find the access log for that request. When the log record includes `trace.trace_id`, filter on the same ID.
6. Check metrics in the managed **Metrics** dataset. On a legacy metrics environment, open the dataset named by `HONEYCOMB_METRICS_DATASET` instead. Query an agentgateway metric such as `agentgateway_gen_ai_client_token_usage`.

Agentgateway and the collector batch their exports, so allow several seconds for new data to appear.

## Troubleshoot the integration

- Confirm that `x-honeycomb-team` is the complete Ingest key. A Configuration key manages Environment resources and is a different credential.
- Confirm that the Ingest key has **Can create services/datasets** enabled when the `agentgateway` dataset does not already exist.
- Confirm that `HONEYCOMB_ENDPOINT` is only the API hostname, without a scheme such as `https://` and without a path. Use `api.honeycomb.io` for the US instance and `api.eu1.honeycomb.io` for the EU instance.
- Confirm that the `HONEYCOMB_*` variables are exported in the environment that agentgateway starts in. Agentgateway resolves the `${...}` references in the configuration file at startup, and it exits with an error if a variable is unset.
- Set `randomSampling: true` while testing so that agentgateway starts a trace for every request.
- On a current Environment, look for traces in the dataset named by `service.name`. Add `x-honeycomb-dataset` for Honeycomb Classic.
- Look for metrics in the managed `Metrics` dataset. On a legacy metrics environment, look in the dataset named by `x-honeycomb-dataset`. A legacy export that omits the header lands in `unknown_metrics`.
- Confirm that the agentgateway metrics endpoint is available before you start the collector.

  ```sh
  curl http://localhost:15020/metrics
  ```

- Check the agentgateway output for OTLP trace or access-log exporter errors.
- Check the collector output for metrics scrape or export errors.

For more information, see the [Honeycomb OpenTelemetry documentation](https://docs.honeycomb.io/send-data/opentelemetry/) and the [OpenTelemetry Collector guide](https://docs.honeycomb.io/send-data/opentelemetry/collector/).

## Cleanup

1. Stop the metrics collector by pressing `Ctrl+C`. If you started it in the background, remove the container.

   ```sh
   docker rm -f honeycomb-metrics-collector
   ```

2. Delete the collector configuration file.

   ```sh
   rm otel-collector-config.yaml
   ```

3. Remove the `frontendPolicies.tracing` and `frontendPolicies.accessLog` sections from your agentgateway configuration file, and restart agentgateway.
4. Unset the Honeycomb environment variables.

   ```sh
   unset HONEYCOMB_API_KEY HONEYCOMB_ENDPOINT HONEYCOMB_METRICS_DATASET
   ```
