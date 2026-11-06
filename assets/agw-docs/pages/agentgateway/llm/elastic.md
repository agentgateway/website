[Elastic](https://www.elastic.co/) is an observability platform built on Elasticsearch. Agentgateway can export traces and access logs directly to an Elastic APM Server over OpenTelemetry Protocol (OTLP). An OpenTelemetry Collector scrapes the agentgateway Prometheus endpoint and forwards metrics to Elastic.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/documentation/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}).
3. Set up an [LLM provider]({{< link-hextra path="/documentation/llm/providers/" >}}) and route in agentgateway.
4. Install the `kubectl` and `helm` command-line tools.
5. Set up an Elastic deployment. You can use [Elastic Cloud](https://cloud.elastic.co/) or run the Elastic Stack in your cluster with the [ECK Operator](https://www.elastic.co/guide/en/cloud-on-k8s/current/k8s-overview.html).

## Configure the Elastic APM endpoint

Save the APM endpoint and authentication in environment variables. Adjust the values based on your deployment type.

For Elastic Cloud with a secret token:

```sh
export ELASTIC_APM_HOST="<your-apm-endpoint>"
export ELASTIC_APM_PORT="443"
export ELASTIC_APM_SECRET_TOKEN="<your-secret-token>"
```

For a self-hosted APM Server accessible within the cluster:

```sh
export ELASTIC_APM_HOST="apm-server.elastic.svc.cluster.local"
export ELASTIC_APM_PORT="8200"
```

Create a Kubernetes Secret in the same namespace as the agentgateway proxy. The Secret stores the APM endpoint details and, for Elastic Cloud, the bearer-token value that agentgateway sends in the `Authorization` header.

For Elastic Cloud:

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: elastic-apm-credentials
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
type: Opaque
stringData:
  authorization: "Bearer ${ELASTIC_APM_SECRET_TOKEN}"
EOF
```

For a self-hosted APM Server with anonymous authentication, you can skip creating the Secret and omit the `auth` section in the backends below.

## Export traces and access logs

The Elastic APM Server accepts traces and logs over OTLP at the standard paths. Create one `{{< reuse "agw-docs/snippets/backend.md" >}}` for traces and one for access logs. Then, attach an `{{< reuse "agw-docs/snippets/policy.md" >}}` that exports traces and access logs from the `agentgateway-proxy` Gateway.

> [!IMPORTANT]
> Before you continue, remove or update any existing `{{< reuse "agw-docs/snippets/policy.md" >}}` that configures tracing or OTLP access-log export for the same Gateway. Multiple policies might report `ATTACHED=True`, but only one exporter configuration per telemetry signal takes effect.

For Elastic Cloud with TLS and a secret token:

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: elastic-traces
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${ELASTIC_APM_HOST}
    port: ${ELASTIC_APM_PORT}
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: Authorization
        secretRef:
          name: elastic-apm-credentials
          key: authorization
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: elastic-logs
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${ELASTIC_APM_HOST}
    port: ${ELASTIC_APM_PORT}
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: Authorization
        secretRef:
          name: elastic-apm-credentials
          key: authorization
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: elastic-observability
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
        name: elastic-traces
        port: ${ELASTIC_APM_PORT}
      protocol: GRPC
      randomSampling: "true"
      clientSampling: "true"
      resources:
      - name: service.name
        expression: '"agentgateway"'
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
          name: elastic-logs
          port: ${ELASTIC_APM_PORT}
        protocol: GRPC
        attributes:
          add:
          - name: llm.input_messages
            expression: 'flattenRecursive(llm.prompt.map(c, {"message": c}))'
          - name: llm.output_messages
            expression: 'flattenRecursive(llm.completion.map(c, {"role": "assistant", "content": c}))'
EOF
```

For a self-hosted APM Server without TLS or authentication, remove the `tls` and `auth` sections from both backends and set the port to `8200`.

Review the following fields before you apply the policy.

| Field | Description |
|-------|-------------|
| `protocol` | OTLP protocol variant. Elastic APM Server accepts both `GRPC` and `HTTP`. The default is `GRPC`. |
| `randomSampling` | Common Expression Language (CEL) expression that determines how often agentgateway starts a new trace. The value `"true"` traces every request, which is useful while you verify the integration. Lower this value for production traffic. |
| `clientSampling` | CEL expression that determines whether agentgateway honors a sampling decision that the client sends. |
| `resources` | Resource attributes that apply to every exported span, such as `service.name`. Each value is a CEL expression, so a literal string is quoted twice. |
| `attributes.add` | Extra key-value pairs to include in each span or access log entry. Each value is a CEL expression. |

The `llm.input_messages` and `llm.output_messages` attributes export the prompt and the completion. Reading `llm.prompt` and `llm.completion` causes agentgateway to inspect the request and response bodies, so omit these attributes if you do not want to export message content.

## Export metrics

Agentgateway exposes Prometheus metrics on port `15020`. Install an OpenTelemetry Collector that discovers the annotated agentgateway proxy pods, scrapes their metrics, and exports the metrics to Elastic over OTLP.

For Elastic Cloud:

```yaml
helm upgrade --install elastic-metrics-collector opentelemetry-collector \
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
- name: ELASTIC_APM_AUTHORIZATION
  valueFrom:
    secretKeyRef:
      name: elastic-apm-credentials
      key: authorization

config:
  receivers:
    prometheus/agentgateway:
      config:
        scrape_configs:
        - job_name: agentgateway
          kubernetes_sd_configs:
          - role: pod
          relabel_configs:
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
    otlp/elastic:
      endpoint: ${ELASTIC_APM_HOST}:${ELASTIC_APM_PORT}
      headers:
        Authorization: "\${env:ELASTIC_APM_AUTHORIZATION}"
  service:
    pipelines:
      metrics:
        receivers: [prometheus/agentgateway]
        processors: [memory_limiter, batch]
        exporters: [otlp/elastic]
EOF
```

Two kinds of variable appear in this command, and the difference matters.

* `${ELASTIC_APM_HOST}` and `${ELASTIC_APM_PORT}` have no backslash, so your shell substitutes the values before Helm reads the file.
* `\${env:ELASTIC_APM_AUTHORIZATION}` is escaped, so the value reaches the collector's configuration file unchanged. The collector then resolves it from the environment variable that `extraEnvs` sets from the Secret. This way, the token stays out of the Helm release.

For a self-hosted APM Server, replace the exporter `endpoint` with the in-cluster address and add `tls.insecure: true` if TLS is not configured.

The `memory_limiter` and `batch` processors come from the chart's default configuration. For production deployments, review the collector's resource requests, memory limiter, batching, and replica count for your expected telemetry volume.

## Get the gateway address

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Verify the integration

1. Verify that Kubernetes accepted both backends and attached the policy to the Gateway.

   ```sh
   kubectl get agentgatewaybackend elastic-traces elastic-logs \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get agentgatewaypolicy elastic-observability \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Both backends report `ACCEPTED=True`. The policy reports `ACCEPTED=True` and `ATTACHED=True`.

2. Verify that the metrics collector is running.

   ```sh
   kubectl rollout status deployment/elastic-metrics-collector-opentelemetry-collector \
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
           "content": "Reply with exactly: Elastic observability works"
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

5. In Kibana, verify each signal.

   - Go to **Observability** > **APM** > **Services**. Select the `agentgateway` service to see the service overview with throughput, latency, and error rate.
   - Click **Transactions** to see individual traces. Find the trace that has the trace ID from step 4. Click it to open the trace waterfall.
   - Go to **Observability** > **APM** > **Traces** to browse all traces. The trace detail view shows span attributes including LLM input and output messages.
   - Go to **Observability** > **Metrics** or use **Discover** to query agentgateway metrics such as `agentgateway_gen_ai_client_token_usage`.

Agentgateway and the collector batch their exports, so allow several seconds for new data to appear.

## Troubleshoot the integration

- Confirm that the Elastic APM Server is running and accessible from the agentgateway proxy pods.
- For Elastic Cloud, confirm that `tls` is set in the backends and that the secret token in the Kubernetes Secret matches the one in the APM integration settings.
- Confirm that no other policy configures the same telemetry signal on the Gateway.

  ```sh
  kubectl get agentgatewaypolicy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```

  An Elastic policy and a previous observability policy can both report `ATTACHED=True`, even though only one trace exporter takes effect. Remove the previous policy, or combine the required settings into one policy.
- Check the `ACCEPTED` and `ATTACHED` status columns for the backends and the policy.
- Check the proxy logs for OTLP trace or access-log exporter errors.

  ```sh
  kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
    | grep -Ei 'opentelemetry|otlp|export'
  ```

- Check the collector logs for metrics scrape or export errors.

  ```sh
  kubectl logs deployment/elastic-metrics-collector-opentelemetry-collector \
    -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```

For more information, see the [Elastic APM OpenTelemetry documentation](https://www.elastic.co/guide/en/apm/guide/current/open-telemetry.html).

## Cleanup

```sh
kubectl delete agentgatewaypolicy elastic-observability -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete agentgatewaybackend elastic-traces elastic-logs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
helm uninstall elastic-metrics-collector -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret elastic-apm-credentials -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
