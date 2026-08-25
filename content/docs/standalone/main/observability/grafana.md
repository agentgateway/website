---
title: Grafana dashboard
weight: 40
description: Import the pre-built Grafana dashboard to visualize agentgateway request, LLM, MCP, and connection metrics.
test:
  grafana:
  - file: ${versionRoot}/observability/grafana.md
    path: grafana
---

Agentgateway ships a pre-built Grafana dashboard that you can import into any Grafana instance. The dashboard visualizes the metrics that agentgateway exposes and is grouped into sections for requests, LLM traffic, MCP traffic, and connections.

## Dashboard sections

The dashboard includes the following sections:

| Section | Panels |
|---------|--------|
| **Overview** | CPU and memory usage (requires Kubernetes container metrics) |
| **Requests** | Request rate, request rate by gateway, by route, and by error reason |
| **LLM** | Token usage (input/output), USD cost, request duration, time to first token, tokens per second |
| **MCP** | MCP request rate, tool call rate by tool |
| **TCP** | Downstream bytes received/sent, upstream connection duration |

{{< conditional-text include-if="kubernetes" >}}

> [!NOTE]
> The CPU and Memory panels in the Overview section use Kubernetes container metrics (`container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`). These panels only show data when agentgateway runs on Kubernetes with a metrics stack such as kube-prometheus-stack. All other sections work in any deployment.

{{< /conditional-text >}}

## Quick start

1. Run Grafana with Docker.

   ```bash {paths="grafana"}
   docker run -d --name grafana \
     -p 3001:3000 \
     grafana/grafana:latest
   ```

   {{< doc-test paths="grafana" >}}
   # ============================================================================
   # Doc test coverage for this guide (these comments are not rendered on the page)
   # ============================================================================
   # WHAT THIS TEST VALIDATES:
   #   * "Quick start" step 1: the docker run command starts Grafana and its API becomes healthy.
   #   * "Import the dashboard" step 2: the curl download URL resolves and returns
   #     valid JSON whose `uid` is "agentgateway".
   #   * Dashboard import (proxy for the manual UI steps 3-4): the dashboard imports into the
   #     running Grafana via the API, and Grafana loads it (`uid` "agentgateway", title "Agentgateway").
   #
   # WHAT THIS TEST DOES NOT VALIDATE (and why):
   #   * "Add a Prometheus data source" - UI-only; no Prometheus is running in the test.
   #   * The manual "Upload dashboard JSON file" UI import - UI-only; the test imports the same
   #     JSON through the Grafana API as a proxy.
   #   * PromQL query examples - display-only, no metrics source.
   #   * That the dashboard panels render data - no agentgateway/Prometheus is wired up.
   # ============================================================================
   # Wait for the Grafana API to become available, then clean up when the test exits.
   trap 'docker rm -f grafana >/dev/null 2>&1; rm -f agentgateway-dashboard.json' EXIT
   for i in $(seq 1 30); do
     curl -sf http://localhost:3001/api/health >/dev/null 2>&1 && break
     sleep 2
   done
   {{< /doc-test >}}

   Access Grafana at [http://localhost:3001](http://localhost:3001) (default credentials: `admin` / `admin`).

2. Add a Prometheus data source.
   1. Go to **Connections** → **Data Sources**.
   2. Click **Add data source** and select **Prometheus**.
   3. Set the URL to your Prometheus instance (for example, `http://prometheus:9090`).
   4. Click **Save & Test**.

3. Import the agentgateway dashboard.

   Download the dashboard JSON from the agentgateway repository:

   ```bash {paths="grafana"}
   curl -L "https://raw.githubusercontent.com/agentgateway/agentgateway/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json" \
     -o agentgateway-dashboard.json
   ```

   {{< doc-test paths="grafana" >}}
   # Confirm the downloaded file is the expected agentgateway dashboard (valid JSON with the
   # agentgateway `uid`).
   jq -e '.uid == "agentgateway"' agentgateway-dashboard.json >/dev/null
   jq '{dashboard: ., overwrite: true}' agentgateway-dashboard.json \
     | curl -sf -u admin:admin -H "Content-Type: application/json" \
         -X POST http://localhost:3001/api/dashboards/db -d @- >/dev/null
   {{< /doc-test >}}

4. In Grafana, go to **Dashboards** → **New** → **Import**.

5. Click **Upload dashboard JSON file** and select the `agentgateway-dashboard.json` file.

6. Select your Prometheus data source and click **Import**.

   {{< doc-test paths="grafana" >}}
   YAMLTest -f - <<'EOF'
   - name: Agentgateway dashboard is loaded in Grafana
     retries: 10
     http:
       url: "http://localhost:3001/api/dashboards/uid/agentgateway"
       method: GET
       headers:
         authorization: "Basic YWRtaW46YWRtaW4="
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.dashboard.title"
           comparator: contains
           value: Agentgateway
   EOF
   {{< /doc-test >}}

## Common PromQL queries

Use these queries to build custom panels or alerts.

### Request rate

```promql
rate(agentgateway_requests_total[5m])
```

### Error rate

```promql
rate(agentgateway_requests_total{status=~"5.."}[5m])
/ rate(agentgateway_requests_total[5m])
```

### LLM token usage (input)

```promql
sum by (gen_ai_system, gen_ai_request_model) (
  rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[5m])
)
```

### Time to first token (p95)

```promql
histogram_quantile(
  0.95,
  rate(agentgateway_gen_ai_server_time_to_first_token_bucket[5m])
)
```

### MCP tool call rate by tool

```promql
sum by (server, resource) (
  rate(agentgateway_mcp_requests_total{method="tools/call"}[5m])
)
```

## Add a Jaeger data source for traces

To correlate metrics with traces in the same Grafana instance:

1. Go to **Connections** → **Data Sources**.
2. Click **Add data source** and select **Jaeger**.
3. Set the URL to your Jaeger instance (for example, `http://jaeger:16686`).
4. Click **Save & Test**.

## Docker Compose example

The following Compose file runs agentgateway alongside Prometheus and Grafana:

```yaml
services:
  agentgateway:
    image: cr.agentgateway.dev/agentgateway:latest
    ports:
      - "3000:3000"
      - "15020:15020"
    volumes:
      - ./config.yaml:/config.yaml:ro
    command: ["-f", "/config.yaml"]

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

Prometheus configuration (`prometheus.yml`):

```yaml
scrape_configs:
  - job_name: agentgateway
    static_configs:
      - targets:
          - agentgateway:15020
    scrape_interval: 15s
```

## Learn more

{{< cards >}}
  {{< card path="/observability/metrics/" title="Metrics" subtitle="Full list of agentgateway metrics and labels" >}}
  {{< card path="/integrations/observability/prometheus/" title="Prometheus" subtitle="Configure Prometheus to scrape agentgateway metrics" >}}
  {{< card path="/integrations/observability/jaeger/" title="Jaeger" subtitle="Distributed tracing with Jaeger" >}}
{{< /cards >}}
