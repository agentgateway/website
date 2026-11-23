---
title: GreptimeDB
weight: 35
description: Integrate agentgateway with GreptimeDB to store LLM traces, access logs, and metrics in one database and query them with SQL and PromQL
---

[GreptimeDB](https://github.com/GreptimeTeam/greptimedb) is an open source observability database that ingests OpenTelemetry traces, logs, and metrics and serves queries in SQL and PromQL. In this guide, you send the traces, access logs, and metrics of agentgateway LLM traffic to a single GreptimeDB instance in your cluster, and then query them for token usage and cost.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) in your Kubernetes cluster.
2. Set up the [OpenAI LLM provider]({{< link-hextra path="/integrations/llm/providers/openai/" >}}) and its `/openai` route. You can use another provider, but the example request in this guide uses the OpenAI route.
3. Set up the [OpenTelemetry stack]({{< link-hextra path="/documentation/observability/otel-stack/" >}}), including the step that enables metrics scraping. In that guide, the `access-logs` and `tracing` {{< reuse "agw-docs/snippets/policy.md" >}} resources send the proxy's access logs and traces to the OpenTelemetry Collectors, and Prometheus scrapes the proxy's metrics. This guide adds GreptimeDB as a destination to the `opentelemetry-collector-logs` and `opentelemetry-collector-traces` collectors and to the `kube-prometheus-stack` Prometheus.

## Install GreptimeDB

Deploy a standalone GreptimeDB instance with Helm. The collectors and Prometheus write to the `greptimedb-standalone` service on the HTTP port, `4000`.

1. Install the GreptimeDB Helm chart.

   ```sh
   helm repo add greptime https://greptimeteam.github.io/helm-charts/
   helm repo update
   helm upgrade --install greptimedb-standalone greptime/greptimedb-standalone \
     --namespace greptimedb \
     --create-namespace
   ```

2. Wait for GreptimeDB to be ready.

   ```sh
   kubectl rollout status statefulset/greptimedb-standalone -n greptimedb
   ```

## Send traces and access logs to GreptimeDB

Add a GreptimeDB exporter to the logs and traces collectors. The following configurations keep the Loki and Tempo exporters from the OpenTelemetry stack guide, so logs and traces still reach those backends. Each `helm upgrade` command replaces the whole configuration of the collector. If you added other exporters to a collector, include them in the command.

GreptimeDB accepts OTLP over HTTP only, so both collectors use the `otlphttp` exporter, which appends `/v1/logs` or `/v1/traces` to the endpoint. GreptimeDB creates the tables on the first write.

1. Update the logs collector. The `X-Greptime-Log-Table-Name` header sets the table for access logs. If you omit the header, GreptimeDB uses `opentelemetry_logs`.

   ```sh
   helm upgrade --install opentelemetry-collector-logs opentelemetry-collector \
     --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
     --version {{< reuse "agw-docs/versions/otel-stack-collector.md" >}} \
     --set mode=deployment \
     --set image.repository="otel/opentelemetry-collector-contrib" \
     --set command.name="otelcol-contrib" \
     --namespace=telemetry \
     --create-namespace \
     -f -<<EOF
   config:
     receivers:
       otlp:
         protocols:
           grpc:
             endpoint: 0.0.0.0:4317
           http:
             endpoint: 0.0.0.0:4318
     exporters:
       otlphttp/loki:
         endpoint: http://loki.telemetry.svc.cluster.local:3100/otlp
         tls:
           insecure: true
       otlphttp/greptimedb:
         endpoint: http://greptimedb-standalone.greptimedb.svc.cluster.local:4000/v1/otlp
         headers:
           X-Greptime-Log-Table-Name: agentgateway_logs
         tls:
           insecure: true
       debug:
         verbosity: detailed
     service:
       pipelines:
         logs:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug, otlphttp/loki, otlphttp/greptimedb]
   EOF
   ```

2. Update the traces collector. GreptimeDB requires the `X-Greptime-Pipeline-Name` header for traces. The `greptime_trace_v2` pipeline stores span, scope, and resource attributes in `JSON2` columns, so new attribute keys do not add table columns. The `X-Greptime-Trace-Table-Name` header sets the table for traces. If you omit the header, GreptimeDB uses `opentelemetry_traces`.

   ```sh
   helm upgrade --install opentelemetry-collector-traces opentelemetry-collector \
     --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
     --version {{< reuse "agw-docs/versions/otel-stack-collector.md" >}} \
     --set mode=deployment \
     --set image.repository="otel/opentelemetry-collector-contrib" \
     --set command.name="otelcol-contrib" \
     --namespace=telemetry \
     --create-namespace \
     -f -<<EOF
   config:
     receivers:
       otlp:
         protocols:
           grpc:
             endpoint: 0.0.0.0:4317
           http:
             endpoint: 0.0.0.0:4318
     exporters:
       otlp/tempo:
         endpoint: http://tempo.telemetry.svc.cluster.local:4317
         tls:
           insecure: true
       otlphttp/greptimedb:
         endpoint: http://greptimedb-standalone.greptimedb.svc.cluster.local:4000/v1/otlp
         headers:
           X-Greptime-Pipeline-Name: greptime_trace_v2
           X-Greptime-Trace-Table-Name: agentgateway_traces
         tls:
           insecure: true
       debug:
         verbosity: detailed
     service:
       pipelines:
         traces:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug, otlp/tempo, otlphttp/greptimedb]
   EOF
   ```

3. Wait for the collectors to restart with the new configuration.

   ```sh
   kubectl rollout status deployment/opentelemetry-collector-logs -n telemetry
   kubectl rollout status deployment/opentelemetry-collector-traces -n telemetry
   ```

## Send metrics to GreptimeDB

Agentgateway exposes Prometheus metrics and does not export metrics over OTLP. To store the metrics in GreptimeDB, add a remote write target to the Prometheus from the OpenTelemetry stack guide. Prometheus then forwards the samples that it scrapes to GreptimeDB. GreptimeDB stores each metric in its own table.

1. Upgrade the Prometheus stack with a remote write target. The `--reuse-values` flag keeps the values from the OpenTelemetry stack guide.

   ```sh
   helm upgrade kube-prometheus-stack kube-prometheus-stack \
     --repo https://prometheus-community.github.io/helm-charts \
     --version {{< reuse "agw-docs/versions/otel-stack-prometheus.md" >}} \
     --namespace telemetry \
     --reuse-values \
     --values - <<EOF
   prometheus:
     prometheusSpec:
       remoteWrite:
       - url: http://greptimedb-standalone.greptimedb.svc.cluster.local:4000/v1/prometheus/write?db=public
   EOF
   ```

2. Verify that the Prometheus resource includes the remote write target.

   ```sh
   kubectl get prometheus -n telemetry -o jsonpath='{.items[0].spec.remoteWrite}'
   ```

   Example output:
   ```console
   [{"url":"http://greptimedb-standalone.greptimedb.svc.cluster.local:4000/v1/prometheus/write?db=public"}]
   ```

## Verify the integration

Send an LLM request through agentgateway, and then query the traces, access logs, and metrics in GreptimeDB.

1. Send a request through agentgateway to the OpenAI route.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json -d '{
     "model": "gpt-4o-mini",
     "messages": [{"role": "user", "content": "Hello!"}]
   }'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" -H content-type:application/json -d '{
     "model": "gpt-4o-mini",
     "messages": [{"role": "user", "content": "Hello!"}]
   }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Port-forward the GreptimeDB HTTP port.

   ```sh
   kubectl port-forward svc/greptimedb-standalone 4000:4000 -n greptimedb
   ```

   The command keeps running in the foreground. Run the rest of the commands in a separate terminal.

3. Query token usage per model from the traces table. Each LLM request produces a server span and a client span for the call to the provider. The `gen_ai` attributes are on the server span. Quote each attribute key, because the key contains dots.

   ```sh
   curl -s localhost:4000/v1/sql --data-urlencode 'sql=
     SELECT span_attributes."gen_ai.request.model"::STRING AS model,
            count(*) AS requests,
            sum(span_attributes."gen_ai.usage.input_tokens"::BIGINT) AS input_tokens,
            sum(span_attributes."gen_ai.usage.output_tokens"::BIGINT) AS output_tokens
     FROM agentgateway_traces
     WHERE span_kind = '"'"'SPAN_KIND_SERVER'"'"'
       AND span_attributes."gen_ai.operation.name"::STRING IS NOT NULL
     GROUP BY model'
   ```

4. Query the latest access logs. GreptimeDB stores the access log attributes in the `log_attributes` JSON column. The `trace_id` column links each log to its trace.

   ```sh
   curl -s localhost:4000/v1/sql --data-urlencode 'sql=
     SELECT timestamp, trace_id, body, log_attributes
     FROM agentgateway_logs
     ORDER BY timestamp DESC
     LIMIT 5'
   ```

5. Query token usage per model from the metrics with PromQL. The OpenTelemetry stack guide sets Prometheus to scrape the proxy every 15 seconds, so wait for at least one scrape after the request before you run the query.

   ```sh
   curl -s 'localhost:4000/v1/prometheus/api/v1/query?db=public' --data-urlencode \
     'query=sum by (gen_ai_request_model, gen_ai_token_type) (agentgateway_gen_ai_client_token_usage_sum)'
   ```

6. Open the GreptimeDB dashboard at [http://localhost:4000/dashboard](http://localhost:4000/dashboard), and click **Signals Explore**. The **Metrics**, **Logs**, and **Traces** tabs show the agentgateway data from the same database.

   {{< reuse-image src="img/greptimedb-agentgateway-metrics.png" srcDark="img/greptimedb-agentgateway-metrics.png" alt="GreptimeDB Signals Explore Metrics tab showing agentgateway gen_ai cost, token usage, and request duration metrics" caption="Agentgateway LLM metrics in GreptimeDB." >}}

   {{< reuse-image src="img/greptimedb-agentgateway-logs.png" srcDark="img/greptimedb-agentgateway-logs.png" alt="GreptimeDB Signals Explore Logs tab listing agentgateway access logs with trace IDs" caption="Agentgateway access logs in GreptimeDB." >}}

   {{< reuse-image src="img/greptimedb-agentgateway-traces.png" srcDark="img/greptimedb-agentgateway-traces.png" alt="GreptimeDB Signals Explore Traces tab showing span rate, errors, and duration for agentgateway" caption="Agentgateway trace overview in GreptimeDB." >}}

   {{< reuse-image src="img/greptimedb-agentgateway-trace-details.png" srcDark="img/greptimedb-agentgateway-trace-details.png" alt="GreptimeDB trace timeline for an agentgateway LLM request, with span attributes that include token usage and cost" caption="An agentgateway LLM trace in GreptimeDB with token usage and cost attributes." >}}

## Learn more

- [GreptimeDB OpenTelemetry ingestion](https://docs.greptime.com/user-guide/ingest-data/for-observability/opentelemetry/)
- [GreptimeDB on Kubernetes](https://docs.greptime.com/user-guide/deployments-administration/deploy-on-kubernetes/deploy-greptimedb-standalone/)
- [GreptimeDB Prometheus remote write](https://docs.greptime.com/user-guide/ingest-data/for-observability/prometheus/)
- [OpenTelemetry stack setup]({{< link-hextra path="/documentation/observability/otel-stack/" >}})
