---
title: GreptimeDB
weight: 35
description: Integrate agentgateway with GreptimeDB to store LLM traces, access logs, and metrics in one database and query them with SQL and PromQL
---

[GreptimeDB](https://greptime.com/) is an open source observability database that ingests OpenTelemetry traces, logs, and metrics and serves queries in SQL and PromQL. In this guide, you send the traces, access logs, and metrics of agentgateway LLM traffic to a single GreptimeDB instance, and then query them for token usage and cost.

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Install [Docker](https://docs.docker.com/get-docker/) to run GreptimeDB and Prometheus.
3. Save your OpenAI API key in an environment variable. Agentgateway reads the key from this variable when it starts.

   ```sh
   export OPENAI_API_KEY=<your-api-key>
   ```

## Start GreptimeDB

Run a standalone GreptimeDB instance with Docker. Agentgateway and Prometheus use only the HTTP port, `4000`.

1. Create a Docker network for GreptimeDB and Prometheus. Prometheus reaches GreptimeDB by its container name on this network.

   ```sh
   docker network create agentgateway-o11y
   ```

2. Start GreptimeDB on the network. The port is published only on the loopback interface of your machine, where agentgateway reaches it.

   ```sh
   docker run -d --network agentgateway-o11y \
     -p 127.0.0.1:4000:4000 \
     -v "$(pwd)/greptimedb_data:/greptimedb_data" \
     --name greptime \
     greptime/greptimedb:v1.3.1 standalone start \
     --http-addr 0.0.0.0:4000
   ```

## Send traces and access logs to GreptimeDB

Agentgateway exports traces and access logs directly to GreptimeDB, without an OpenTelemetry Collector. GreptimeDB accepts OTLP over HTTP only, so both exporters use `protocol: http`. GreptimeDB creates the tables on the first write.

1. Create a configuration that routes LLM traffic to OpenAI and exports traces and access logs to GreptimeDB.

   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
   frontendPolicies:
     tracing:
       host: localhost:4000
       protocol: http
       path: /v1/otlp/v1/traces
       randomSampling: true
       policies:
         requestHeaderModifier:
           set:
             X-Greptime-Pipeline-Name: greptime_trace_v1
             X-Greptime-Trace-Table-Name: agentgateway_traces
     accessLog:
       otlp:
         host: localhost:4000
         protocol: http
         path: /v1/otlp/v1/logs
         policies:
           requestHeaderModifier:
             set:
               X-Greptime-Log-Table-Name: agentgateway_logs
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - ai:
         name: openai
         provider:
           openAI:
             model: gpt-4o-mini
     policies:
       backendAuth:
         key: "$OPENAI_API_KEY"
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | `frontendPolicies.tracing.protocol`, `frontendPolicies.accessLog.otlp.protocol` | Must be `http`. GreptimeDB does not accept OTLP over gRPC. |
   | `frontendPolicies.tracing.path` | The GreptimeDB OTLP traces endpoint, `/v1/otlp/v1/traces`. |
   | `frontendPolicies.accessLog.otlp.path` | The GreptimeDB OTLP logs endpoint, `/v1/otlp/v1/logs`. |
   | `X-Greptime-Pipeline-Name` | Required for traces. The `greptime_trace_v1` pipeline stores each span attribute and resource attribute in its own column. |
   | `X-Greptime-Trace-Table-Name` | The table for traces. If you omit the header, GreptimeDB uses `opentelemetry_traces`. |
   | `X-Greptime-Log-Table-Name` | The table for access logs. If you omit the header, GreptimeDB uses `opentelemetry_logs`. |

2. Start agentgateway with the configuration.

   ```sh
   agentgateway -f config.yaml
   ```

## Send metrics to GreptimeDB

Agentgateway exposes Prometheus metrics on port `15020` and does not export metrics over OTLP. To store the metrics in GreptimeDB, run Prometheus to scrape the metrics endpoint and forward the samples with remote write. GreptimeDB stores each metric in its own table.

1. Create a Prometheus configuration that scrapes agentgateway and writes to GreptimeDB. Prometheus scrapes agentgateway on your machine through `host.docker.internal`, and writes to GreptimeDB through the `greptime` container name.

   ```sh
   cat <<'EOF' > prometheus.yml
   global:
     scrape_interval: 15s
   scrape_configs:
   - job_name: agentgateway
     static_configs:
     - targets: ['host.docker.internal:15020']
   remote_write:
   - url: http://greptime:4000/v1/prometheus/write?db=public
   EOF
   ```

2. Start Prometheus on the same network. The `--add-host` flag maps `host.docker.internal` to your machine on Linux. Docker Desktop provides this name by default.

   ```sh
   docker run -d --network agentgateway-o11y \
     -p 127.0.0.1:9090:9090 \
     --add-host=host.docker.internal:host-gateway \
     -v "$(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml" \
     --name prometheus \
     prom/prometheus:v3.16.0
   ```

## Verify the integration

Send an LLM request through agentgateway, and then query the traces, access logs, and metrics in GreptimeDB.

1. In a separate terminal, send a request to the OpenAI route.

   ```sh
   curl localhost:3000/v1/chat/completions -H content-type:application/json -d '{
     "model": "gpt-4o-mini",
     "messages": [{"role": "user", "content": "Hello!"}]
   }'
   ```

2. Query token usage per model from the traces table. Each LLM request produces a server span and a client span for the call to the provider. The `gen_ai` attributes are on the server span.

   ```sh
   curl -s localhost:4000/v1/sql --data-urlencode 'sql=
     SELECT "span_attributes.gen_ai.request.model" AS model,
            count(*) AS requests,
            sum("span_attributes.gen_ai.usage.input_tokens") AS input_tokens,
            sum("span_attributes.gen_ai.usage.output_tokens") AS output_tokens
     FROM agentgateway_traces
     WHERE span_kind = '"'"'SPAN_KIND_SERVER'"'"'
       AND "span_attributes.gen_ai.operation.name" IS NOT NULL
     GROUP BY model'
   ```

3. Query the latest access logs. GreptimeDB stores the access log attributes in the `log_attributes` JSON column. The `trace_id` column links each log to its trace.

   ```sh
   curl -s localhost:4000/v1/sql --data-urlencode 'sql=
     SELECT timestamp, trace_id, body, log_attributes
     FROM agentgateway_logs
     ORDER BY timestamp DESC
     LIMIT 5'
   ```

4. Query token usage per model from the metrics with PromQL. Prometheus scrapes agentgateway every 15 seconds, so wait for at least one scrape after the request before you run the query.

   ```sh
   curl -s 'localhost:4000/v1/prometheus/api/v1/query?db=public' --data-urlencode \
     'query=sum by (gen_ai_request_model, gen_ai_token_type) (agentgateway_gen_ai_client_token_usage_sum)'
   ```

5. Open the GreptimeDB dashboard at [http://localhost:4000/dashboard](http://localhost:4000/dashboard), and click **Signals Explore**. The **Metrics**, **Logs**, and **Traces** tabs show the agentgateway data from the same database.

   {{< reuse-image src="img/greptimedb-agentgateway-metrics.png" srcDark="img/greptimedb-agentgateway-metrics.png" alt="GreptimeDB Signals Explore Metrics tab showing agentgateway gen_ai cost, token usage, and request duration metrics" caption="Agentgateway LLM metrics in GreptimeDB." >}}

   {{< reuse-image src="img/greptimedb-agentgateway-logs.png" srcDark="img/greptimedb-agentgateway-logs.png" alt="GreptimeDB Signals Explore Logs tab listing agentgateway access logs with trace IDs" caption="Agentgateway access logs in GreptimeDB." >}}

   {{< reuse-image src="img/greptimedb-agentgateway-traces.png" srcDark="img/greptimedb-agentgateway-traces.png" alt="GreptimeDB Signals Explore Traces tab showing span rate, errors, and duration for agentgateway" caption="Agentgateway trace overview in GreptimeDB." >}}

   {{< reuse-image src="img/greptimedb-agentgateway-trace-details.png" srcDark="img/greptimedb-agentgateway-trace-details.png" alt="GreptimeDB trace timeline for an agentgateway LLM request, with span attributes that include token usage and cost" caption="An agentgateway LLM trace in GreptimeDB with token usage and cost attributes." >}}

## Learn more

- [GreptimeDB OpenTelemetry ingestion](https://docs.greptime.com/user-guide/ingest-data/for-observability/opentelemetry/)
- [GreptimeDB trace data model](https://docs.greptime.com/user-guide/traces/data-model/)
- [GreptimeDB Prometheus remote write](https://docs.greptime.com/user-guide/ingest-data/for-observability/prometheus/)
- [OpenTelemetry integration]({{< link-hextra path="/documentation/observability/traces/setup/" >}})
