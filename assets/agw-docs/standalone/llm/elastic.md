[Elastic](https://www.elastic.co/) is an observability platform built on Elasticsearch. Agentgateway can export traces and access logs directly to an Elastic APM Server over OpenTelemetry Protocol (OTLP). An OpenTelemetry Collector scrapes the agentgateway Prometheus endpoint and forwards metrics to Elastic.

## Before you begin

1. [Complete the LLM quickstart]({{< link-hextra path="/documentation/quickstart/llm/" >}}).
2. Install Docker and Docker Compose if you want to run a local Elastic Stack or export metrics.
3. Set up an Elastic deployment. You can use [Elastic Cloud](https://cloud.elastic.co/) or run the Elastic Stack locally.

## Set up the Elastic Stack

You can use an existing Elastic Cloud deployment or run the Elastic Stack locally with Docker Compose.

### Option A: Elastic Cloud

1. Sign up for an [Elastic Cloud](https://cloud.elastic.co/) account and create a deployment.
2. In Kibana, go to **Management** > **Fleet** > **Settings** and find the Elastic APM endpoint URL.
3. Create a secret token or API key for APM agent authentication. In Kibana, go to **Fleet** > **Agent policies**, select the Elastic Cloud agent policy, and find the APM integration settings.

### Option B: Local Elastic Stack

1. Create a `docker-compose-elastic.yaml` file.

   ```yaml
   services:
     elasticsearch:
       image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
       environment:
         - discovery.type=single-node
         - xpack.security.enabled=false
         - ES_JAVA_OPTS=-Xms512m -Xmx512m
       ports:
         - "9200:9200"
     kibana:
       image: docker.elastic.co/kibana/kibana:8.17.0
       environment:
         - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
       ports:
         - "5601:5601"
       depends_on:
         - elasticsearch
     apm-server:
       image: docker.elastic.co/apm/apm-server:8.17.0
       command: >
         apm-server -e
           -E apm-server.host=0.0.0.0:8200
           -E output.elasticsearch.hosts=["elasticsearch:9200"]
           -E apm-server.auth.anonymous.enabled=true
       ports:
         - "8200:8200"
       depends_on:
         - elasticsearch
   ```

2. Start the Elastic Stack.

   ```sh
   docker compose -f docker-compose-elastic.yaml up -d
   ```

3. Wait for all services to start. Kibana is available at `http://localhost:5601`.

## Configure environment variables

Save the APM endpoint and authentication in environment variables. Adjust the values based on your deployment type.

For a local Elastic Stack with anonymous authentication:

```sh
export ELASTIC_APM_HOST="localhost"
export ELASTIC_APM_PORT="8200"
```

For Elastic Cloud with a secret token:

```sh
export ELASTIC_APM_HOST="<your-apm-endpoint>"
export ELASTIC_APM_PORT="443"
export ELASTIC_APM_SECRET_TOKEN="<your-secret-token>"
```

> [!IMPORTANT]
> Agentgateway resolves `${...}` references in the configuration file from its own environment when the process starts, and it exits with an error if a referenced variable is unset. Export these variables in the same terminal that you start agentgateway from, or set them another way, such as in a systemd unit or a Docker `--env-file`.

## Export traces and access logs

Add the following `frontendPolicies` section to your agentgateway configuration. The Elastic APM Server accepts traces and logs over OTLP at the standard paths.

For a local Elastic Stack without authentication:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: ${ELASTIC_APM_HOST}:${ELASTIC_APM_PORT}
    protocol: grpc
    randomSampling: true
    clientSampling: true
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
      host: ${ELASTIC_APM_HOST}:${ELASTIC_APM_PORT}
      protocol: grpc
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

For Elastic Cloud with TLS and a secret token:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  tracing:
    host: ${ELASTIC_APM_HOST}:${ELASTIC_APM_PORT}
    protocol: grpc
    randomSampling: true
    clientSampling: true
    policies:
      backendTLS: {}
      requestHeaderModifier:
        set:
          Authorization: Bearer ${ELASTIC_APM_SECRET_TOKEN}
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
      host: ${ELASTIC_APM_HOST}:${ELASTIC_APM_PORT}
      protocol: grpc
      policies:
        backendTLS: {}
        requestHeaderModifier:
          set:
            Authorization: Bearer ${ELASTIC_APM_SECRET_TOKEN}
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
| `host` | Elastic APM Server host and port, in `hostname:port` format. |
| `protocol` | OTLP protocol variant. Elastic APM Server accepts both `grpc` and `http`. |
| `randomSampling` | Determines how often agentgateway starts a new trace. The value `true` traces every request, which is useful while you verify the integration. Lower this value for production traffic. |
| `clientSampling` | Determines whether agentgateway honors a sampling decision that the client sends. |
| `policies.backendTLS` | Enables TLS for the connection to Elastic. Required for Elastic Cloud. An empty object uses the default settings. |
| `policies.requestHeaderModifier.set` | Headers that agentgateway sends with each export request. Elastic Cloud requires the `Authorization` header with a bearer token. |
| `resources` | Resource attributes that apply to every exported span, such as `service.name`. Each value is a Common Expression Language (CEL) expression, so a literal string is quoted twice. |
| `attributes` and `fields.add` | Extra key-value pairs to include in each span or access log entry. Each value is a CEL expression. |

The `llm.input_messages` and `llm.output_messages` attributes export the prompt and the completion. Reading `llm.prompt` and `llm.completion` causes agentgateway to inspect the request and response bodies, so omit these attributes if you do not want to export message content.

## Export metrics

Agentgateway exposes Prometheus metrics on port `15020`. Run an OpenTelemetry Collector that scrapes this endpoint and exports the metrics to Elastic over OTLP.

1. Create an `otel-collector-config.yaml` file.

   For a local Elastic Stack:

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
     otlp/elastic:
       endpoint: host.docker.internal:8200
       tls:
         insecure: true

   service:
     pipelines:
       metrics:
         receivers: [prometheus/agentgateway]
         processors: [memory_limiter, batch]
         exporters: [otlp/elastic]
   ```

   For Elastic Cloud, replace the exporter with:

   ```yaml
   exporters:
     otlp/elastic:
       endpoint: ${env:ELASTIC_APM_HOST}:${env:ELASTIC_APM_PORT}
       headers:
         Authorization: "Bearer ${env:ELASTIC_APM_SECRET_TOKEN}"
   ```

2. Start the OpenTelemetry Collector. The `host-gateway` entry lets the container scrape the agentgateway process that runs on the host.

   ```sh
   docker run --rm --name elastic-metrics-collector \
     --add-host=host.docker.internal:host-gateway \
     -v "$PWD/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml:ro" \
     -e ELASTIC_APM_HOST \
     -e ELASTIC_APM_PORT \
     -e ELASTIC_APM_SECRET_TOKEN \
     otel/opentelemetry-collector-contrib:0.128.0
   ```

For production deployments, review the collector's resource limits, batching, and deployment model for your expected telemetry volume.

## Verify the integration

1. Start agentgateway with the updated configuration, in a terminal where the `ELASTIC_*` variables are exported.
2. Send an LLM request through agentgateway. The following example assumes that agentgateway runs locally on port `4000` and that you configured an OpenAI-compatible provider and the `gpt-3.5-turbo` model.

   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H 'content-type: application/json' \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "Reply with exactly: Elastic observability works"
         }
       ]
     }'
   ```

3. Find the request in the agentgateway logs and copy its `trace.id` value. A successful request resembles the following example.

   ```text
   info request gateway=default/default route=internal/llm:request http.status=200 trace.id=4d50f6d1cb4099a1a22e50b6d339d5f2 span.id=a3f2ae9119406264 protocol=llm gen_ai.provider.name=openai
   ```

4. In Kibana, verify each signal.

   - Go to **Observability** > **APM** > **Services**. Select the `agentgateway` service to see the service overview with throughput, latency, and error rate.
   - Click **Transactions** to see individual traces. Find the trace that has the trace ID from step 3. Click it to open the trace waterfall.
   - Go to **Observability** > **APM** > **Traces** to browse all traces. The trace detail view shows span attributes including LLM input and output messages.
   - Go to **Observability** > **Metrics** or use **Discover** to query agentgateway metrics such as `agentgateway_gen_ai_client_token_usage`.

Agentgateway and the collector batch their exports, so allow several seconds for new data to appear.

## Troubleshoot the integration

- Confirm that the Elastic APM Server is running and accessible from the agentgateway host.

  ```sh
  curl http://localhost:8200/
  ```

  A running APM Server returns a JSON response with version information.

- Confirm that the `ELASTIC_*` variables are exported in the environment that agentgateway starts in. Agentgateway resolves the `${...}` references in the configuration file at startup, and it exits with an error if a variable is unset.
- For Elastic Cloud, confirm that `backendTLS` is set and that the secret token matches the one in the APM integration settings.
- Set `randomSampling: true` while testing so that agentgateway starts a trace for every request.
- Confirm that the agentgateway metrics endpoint is available before you start the collector.

  ```sh
  curl http://localhost:15020/metrics
  ```

- Check the agentgateway output for OTLP trace or access-log exporter errors.
- Check the collector output for metrics scrape or export errors.

For more information, see the [Elastic APM OpenTelemetry documentation](https://www.elastic.co/guide/en/apm/guide/current/open-telemetry.html).

## Cleanup

1. Stop the metrics collector by pressing `Ctrl+C`. If you started it in the background, remove the container.

   ```sh
   docker rm -f elastic-metrics-collector
   ```

2. Delete the collector configuration file.

   ```sh
   rm otel-collector-config.yaml
   ```

3. Remove the `frontendPolicies.tracing` and `frontendPolicies.accessLog` sections from your agentgateway configuration file, and restart agentgateway.
4. If you ran a local Elastic Stack, stop and remove it.

   ```sh
   docker compose -f docker-compose-elastic.yaml down -v
   rm docker-compose-elastic.yaml
   ```

5. Unset the Elastic environment variables.

   ```sh
   unset ELASTIC_APM_HOST ELASTIC_APM_PORT ELASTIC_APM_SECRET_TOKEN
   ```
