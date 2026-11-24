[Honeycomb](https://www.honeycomb.io/) is an observability platform that accepts OpenTelemetry traces, logs, and metrics. Agentgateway can export traces and access logs directly to Honeycomb over OpenTelemetry Protocol (OTLP) HTTP. An OpenTelemetry Collector scrapes the agentgateway Prometheus endpoint and forwards metrics to Honeycomb.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}). The Gateway in that guide is named `agentgateway-proxy`.
3. Set up an [LLM provider]({{< link-hextra path="/documentation/llm/providers/" >}}) and route in agentgateway.
4. Install the `kubectl` and `helm` command-line tools.
5. Sign up for a [Honeycomb account](https://ui.honeycomb.io/signup). You need the Team Owner role to create an Ingest API key.

## Create a Honeycomb Ingest key

Honeycomb authenticates OTLP exports with an Environment Ingest key in the `x-honeycomb-team` header. Create the key in the Environment that should store agentgateway telemetry, store it in a Kubernetes Secret, and allow it to create datasets.

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

9. Create a Kubernetes Secret in the same namespace as the agentgateway proxy. The Secret stores the Ingest key and the metrics dataset name.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: honeycomb-credentials
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     api-key: "${HONEYCOMB_API_KEY}"
     metrics-dataset: "${HONEYCOMB_METRICS_DATASET}"
   EOF
   ```

## Export traces and access logs

Traces and access logs both send `x-honeycomb-team`, so they can share one `{{< reuse "agw-docs/snippets/backend.md" >}}`. Attach an `{{< reuse "agw-docs/snippets/policy.md" >}}` that exports traces and access logs from the `agentgateway-proxy` Gateway.

> [!IMPORTANT]
> Before you continue, remove or update any existing `{{< reuse "agw-docs/snippets/policy.md" >}}` that configures tracing or OTLP access-log export for the same Gateway. Multiple policies might report `ATTACHED=True`, but only one exporter configuration per telemetry signal takes effect.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: honeycomb
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${HONEYCOMB_ENDPOINT}
    port: 443
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: x-honeycomb-team
        secretRef:
          name: honeycomb-credentials
          key: api-key
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: honeycomb-observability
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    tracing:
      backendRef:
        group: {{< reuse "agw-docs/snippets/group.md" >}}
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
        name: honeycomb
        port: 443
      protocol: HTTP
      randomSampling: "true"
      clientSampling: "true"
      resources:
      - name: service.name
        expression: '"agentgateway-proxy"'
      attributes:
        add:
        - name: llm.input_messages
          expression: 'flattenRecursive(llm.prompt.map(c, {"message": c}))'
        - name: llm.output_messages
          expression: 'flattenRecursive(llm.completion.map(c, {"role": "assistant", "content": c}))'
    accessLog:
      otlp:
        backendRef:
          group: {{< reuse "agw-docs/snippets/group.md" >}}
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
          name: honeycomb
          port: 443
        protocol: HTTP
        attributes:
          add:
          - name: llm.input_messages
            expression: 'flattenRecursive(llm.prompt.map(c, {"message": c}))'
          - name: llm.output_messages
            expression: 'flattenRecursive(llm.completion.map(c, {"role": "assistant", "content": c}))'
EOF
```

Review the following fields before you apply the policy.

| Field | Description |
|-------|-------------|
| `protocol` | OTLP protocol variant. Set this field to `HTTP`. Honeycomb accepts OTLP over HTTP at `/v1/traces` and `/v1/logs`. The default is `GRPC`. |
| `randomSampling` | Common Expression Language (CEL) expression that determines how often agentgateway starts a new trace. The value `"true"` traces every request, which is useful while you verify the integration. Lower this value for production traffic. |
| `clientSampling` | CEL expression that determines whether agentgateway honors a sampling decision that the client sends. |
| `resources` | Resource attributes that apply to every exported span. Each value is a CEL expression, so a literal string is quoted twice. Honeycomb names the trace dataset from `service.name`. |
| `attributes.add` | Extra key-value pairs to include in each span or access log entry. Each value is a CEL expression. |

Neither exporter sets a `path` field, so agentgateway uses the default OTLP/HTTP paths, `/v1/traces` for traces and `/v1/logs` for access logs. Honeycomb expects both of these paths. For the signal-specific URLs, see [Honeycomb's OpenTelemetry endpoint reference](https://docs.honeycomb.io/send-data/opentelemetry/).

The trace `service.name` in this example is `agentgateway-proxy`, which is the Gateway name from the setup guide. The proxy chart sets the `GATEWAY` environment variable to that name, and access logs use it as their `service.name`. Honeycomb then stores traces and access logs in one dataset. If your Gateway has a different name, set the trace expression to that name. When a log record includes `service.name`, Honeycomb uses that value as the dataset name and ignores `x-honeycomb-dataset`.

The `llm.input_messages` and `llm.output_messages` attributes export the prompt and the completion. Reading `llm.prompt` and `llm.completion` causes agentgateway to inspect the request and response bodies, so omit these attributes if you do not want to export message content.

Honeycomb Classic still requires `x-honeycomb-dataset` on the trace export. Add a second credential on the backend, with header name `x-honeycomb-dataset`, when your team uses Classic. Current Environments name the trace dataset from `service.name`.

## Export metrics

Agentgateway exposes Prometheus metrics on port `15020`. Install an OpenTelemetry Collector that discovers the annotated agentgateway proxy pods, scrapes their metrics, and exports the metrics to Honeycomb over OTLP/HTTP.

Honeycomb's Collector example sends `x-honeycomb-dataset` on the metrics pipeline. Legacy metrics environments store those metrics in the named dataset. When the header is absent, legacy metrics land in `unknown_metrics`. Environments on the current metrics experience store metrics in a managed dataset named `Metrics` and ignore the header. The configuration below sends the header so both experiences accept the export.

```yaml
helm upgrade --install honeycomb-metrics-collector opentelemetry-collector \
  --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
  --version 0.127.2 \
  --set mode=deployment \
  --set image.repository="otel/opentelemetry-collector-contrib" \
  --set command.name="otelcol-contrib" \
  --namespace={{< reuse "agw-docs/snippets/namespace.md" >}} \
  -f - <<EOF
clusterRole:
  create: true
  rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]

extraEnvs:
- name: HONEYCOMB_API_KEY
  valueFrom:
    secretKeyRef:
      name: honeycomb-credentials
      key: api-key
- name: HONEYCOMB_METRICS_DATASET
  valueFrom:
    secretKeyRef:
      name: honeycomb-credentials
      key: metrics-dataset

config:
  receivers:
    prometheus/agentgateway:
      config:
        scrape_configs:
        - job_name: agentgateway
          kubernetes_sd_configs:
          - role: pod
          relabel_configs:
          # Keep only the pods of Gateways that use the agentgateway GatewayClass.
          - action: keep
            regex: agentgateway
            source_labels:
            - __meta_kubernetes_pod_label_gateway_networking_k8s_io_gateway_class_name
          - action: keep
            regex: "true"
            source_labels:
            - __meta_kubernetes_pod_annotation_prometheus_io_scrape
          - action: replace
            regex: (.+)
            source_labels:
            - __meta_kubernetes_pod_annotation_prometheus_io_path
            target_label: __metrics_path__
          - action: replace
            separator: ":"
            source_labels:
            - __meta_kubernetes_pod_ip
            - __meta_kubernetes_pod_annotation_prometheus_io_port
            target_label: __address__
          - action: replace
            source_labels:
            - __meta_kubernetes_namespace
            target_label: namespace
          - action: replace
            source_labels:
            - __meta_kubernetes_pod_name
            target_label: pod
  exporters:
    otlphttp/honeycomb:
      endpoint: https://${HONEYCOMB_ENDPOINT}:443
      headers:
        x-honeycomb-team: "\${env:HONEYCOMB_API_KEY}"
        x-honeycomb-dataset: "\${env:HONEYCOMB_METRICS_DATASET}"
  service:
    pipelines:
      metrics:
        receivers: [prometheus/agentgateway]
        processors: [memory_limiter, batch]
        exporters: [otlphttp/honeycomb]
EOF
```

Two kinds of variable appear in this command, and the difference matters.

* `${HONEYCOMB_ENDPOINT}` has no backslash, so your shell substitutes the hostname before Helm reads the file.
* `\${env:HONEYCOMB_API_KEY}` is escaped, so the value reaches the collector's configuration file unchanged. The collector then resolves it from the environment variable that `extraEnvs` sets from the Secret. This way, the Ingest key stays out of the Helm release.

The `memory_limiter` and `batch` processors come from the chart's default configuration. For production deployments, review the collector's resource requests, memory limiter, batching, and replica count for your expected telemetry volume. Honeycomb documents a 15 MB request size limit for OTLP exports.

## Get the gateway address

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Verify the integration

<!-- TODO: Add verified Honeycomb UI screenshots of an agentgateway trace waterfall and a metrics query. This docs environment had no Honeycomb Ingest key, so the UI was not captured. -->

1. Verify that Kubernetes accepted the backend and attached the policy to the Gateway.

   ```sh
   kubectl get agentgatewaybackend honeycomb \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get agentgatewaypolicy honeycomb-observability \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   The backend reports `ACCEPTED=True`. The policy reports `ACCEPTED=True` and `ATTACHED=True`.

2. Verify that the metrics collector is running.

   ```sh
   kubectl rollout status deployment/honeycomb-metrics-collector-opentelemetry-collector \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Send an LLM request through agentgateway. The following example assumes that you configured an OpenAI-compatible provider and the `gpt-3.5-turbo` model.

   ```sh
   curl http://$INGRESS_GW_ADDRESS/v1/chat/completions \
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

4. Find the request in the proxy logs and copy the `trace.id` value that the log line reports.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     | grep 'protocol=llm' \
     | tail -1
   ```

5. In Honeycomb, open the Environment that owns the Ingest key, then open the `agentgateway-proxy` dataset. From the left sidebar, select **New Query**. In Query Builder, filter on the trace ID you copied, for example `trace.trace_id = 4d50f6d1cb4099a1a22e50b6d339d5f2`. Select **Run Query**. In the results, select the `trace.trace_id` value to open the trace waterfall.
6. In the same dataset, find the access log for that request. When the log record includes `trace.trace_id`, filter on the same ID.
7. Check metrics in the managed **Metrics** dataset. On a legacy metrics environment, open the dataset named by `HONEYCOMB_METRICS_DATASET` instead. Query an agentgateway metric such as `agentgateway_gen_ai_client_token_usage`.

Agentgateway and the collector batch their exports, so allow several seconds for new data to appear.

## Troubleshoot the integration

- Confirm that `HONEYCOMB_ENDPOINT` is only the API hostname, without a scheme such as `https://` and without a path. Use `api.honeycomb.io` for the US instance and `api.eu1.honeycomb.io` for the EU instance.
- Confirm that `x-honeycomb-team` is the complete Ingest key. A Configuration key manages Environment resources and is a different credential.
- Confirm that the Ingest key has **Can create services/datasets** enabled when the `agentgateway-proxy` dataset does not already exist.
- On a current Environment, look for traces and access logs in the dataset named by `service.name`. With the standard Gateway name, that dataset is `agentgateway-proxy`. Add `x-honeycomb-dataset` for Honeycomb Classic.
- Look for metrics in the managed `Metrics` dataset. On a legacy metrics environment, look in the dataset named by `x-honeycomb-dataset`. A legacy export that omits the header lands in `unknown_metrics`.
- Confirm that no other policy configures the same telemetry signal on the Gateway.

  ```sh
  kubectl get agentgatewaypolicy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```

  A Honeycomb policy and a previous observability policy can both report `ATTACHED=True`, even though only one trace exporter takes effect. Remove the previous policy, or combine the required settings into one policy.
- Check the `ACCEPTED` and `ATTACHED` status columns for the backend and the policy.
- Check the proxy logs for OTLP trace or access-log exporter errors.

  ```sh
  kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
    | grep -Ei 'opentelemetry|otlp|export'
  ```

- Check the collector logs for metrics scrape or export errors.

  ```sh
  kubectl logs deployment/honeycomb-metrics-collector-opentelemetry-collector \
    -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```

For more information, see the [Honeycomb OpenTelemetry documentation](https://docs.honeycomb.io/send-data/opentelemetry/) and the [OpenTelemetry Collector guide](https://docs.honeycomb.io/send-data/opentelemetry/collector/).

## Cleanup

```sh
kubectl delete agentgatewaypolicy honeycomb-observability -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete agentgatewaybackend honeycomb -n {{< reuse "agw-docs/snippets/namespace.md" >}}
helm uninstall honeycomb-metrics-collector -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret honeycomb-credentials -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
