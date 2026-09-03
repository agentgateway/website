---
title: Axiom
weight: 5
description: Export agentgateway traces, access logs, and metrics to Axiom.
test: skip
---

[Axiom](https://axiom.co/) is an observability platform that accepts OpenTelemetry traces, logs, and metrics. Agentgateway can export traces and access logs directly to Axiom over OpenTelemetry Protocol (OTLP) HTTP. An OpenTelemetry Collector scrapes the agentgateway Prometheus endpoint and forwards metrics to Axiom.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
3. Set up an [LLM provider]({{< link-hextra path="/llm/providers/" >}}) and route in agentgateway.
4. Install the `kubectl` and `helm` command-line tools.
5. Sign up for an [Axiom account](https://app.axiom.co/).

## Create the Axiom datasets and API token

Axiom requires a dedicated dataset for each OpenTelemetry signal. Create two Events datasets for traces and access logs, and one Metrics dataset for metrics. Then, create an API token that can send data to all three datasets, and store the token in a Kubernetes Secret.

1. Log in to the [Axiom dashboard](https://app.axiom.co/).
2. Go to **Settings** > **Datasets and views**, and click **New dataset**.
3. Create the following datasets. You can use different names.

   | Example name | Kind | Signal |
   |--------------|------|--------|
   | `agentgateway-traces` | Events | Traces |
   | `agentgateway-logs` | Events | Access logs |
   | `agentgateway-metrics` | Metrics | Metrics |

4. Go to **Settings** > **API tokens**, and click **New API token**.
5. Give the token a name, select **Basic**, and grant it ingest access to all three datasets.
6. Create the token and copy it immediately. Axiom does not display the token again.

   {{< reuse-image src="img/axiom-agentgateway-api-token.jpg" srcDark="img/axiom-agentgateway-api-token.jpg" alt="Axiom API token settings showing ingest access limited to the agentgateway logs, metrics, and traces datasets" caption="A Basic Axiom API token scoped to the three agentgateway telemetry datasets." >}}

7. Save the token and dataset names in environment variables. Do not commit these values to source control.

   ```sh
   export AXIOM_API_TOKEN="<your-api-token>"
   export AXIOM_TRACES_DATASET="agentgateway-traces"
   export AXIOM_LOGS_DATASET="agentgateway-logs"
   export AXIOM_METRICS_DATASET="agentgateway-metrics"
   ```

8. Set the Axiom ingest domain. The following example uses the Axiom Cloud API endpoint. If your datasets use an [edge deployment](https://axiom.co/docs/restapi/introduction#base-domain), set this variable to its base domain instead. Include only the hostname, without a scheme such as `https://` and without a trailing path.

   ```sh
   export AXIOM_DOMAIN="api.axiom.co"
   ```

9. Create a Kubernetes Secret in the same namespace as the agentgateway proxy. The Secret stores the complete bearer-token value that agentgateway and the OpenTelemetry Collector send in the `Authorization` header, along with the name of each dataset.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: axiom-credentials
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     authorization: "Bearer ${AXIOM_API_TOKEN}"
     traces-dataset: "${AXIOM_TRACES_DATASET}"
     logs-dataset: "${AXIOM_LOGS_DATASET}"
     metrics-dataset: "${AXIOM_METRICS_DATASET}"
   EOF
   ```

## Export traces and access logs

Axiom selects the destination dataset from the `x-axiom-dataset` header, and traces and access logs go to different datasets. Because the header value is fixed per backend, create one `{{< reuse "agw-docs/snippets/backend.md" >}}` for each signal. Then, attach an `{{< reuse "agw-docs/snippets/policy.md" >}}` that exports traces and access logs from the `agentgateway-proxy` Gateway.

> [!IMPORTANT]
> Before you continue, remove or update any existing `{{< reuse "agw-docs/snippets/policy.md" >}}` that configures tracing or OTLP access-log export for the same Gateway. Multiple policies might report `ATTACHED=True`, but only one exporter configuration per telemetry signal takes effect.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: axiom-traces
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${AXIOM_DOMAIN}
    port: 443
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: Authorization
        secretRef:
          name: axiom-credentials
          key: authorization
      - location:
          header:
            name: x-axiom-dataset
        secretRef:
          name: axiom-credentials
          key: traces-dataset
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: axiom-logs
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  static:
    host: ${AXIOM_DOMAIN}
    port: 443
  policies:
    tls: {}
    auth:
      credentials:
      - location:
          header:
            name: Authorization
        secretRef:
          name: axiom-credentials
          key: authorization
      - location:
          header:
            name: x-axiom-dataset
        secretRef:
          name: axiom-credentials
          key: logs-dataset
---
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: axiom-observability
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    tracing:
      backendRef:
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
        name: axiom-traces
        port: 443
      protocol: HTTP
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
          group: agentgateway.dev
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
          name: axiom-logs
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
| `protocol` | OTLP protocol variant. Set this field to `HTTP`, because Axiom accepts OTLP over HTTP. The default is `GRPC`. |
| `randomSampling` | Common Expression Language (CEL) expression that determines how often agentgateway starts a new trace. The value `"true"` traces every request, which is useful while you verify the integration. Lower this value for production traffic. |
| `clientSampling` | CEL expression that determines whether agentgateway honors a sampling decision that the client sends. |
| `resources` | Resource attributes that apply to every exported span, such as `service.name`. Each value is a CEL expression, so a literal string is quoted twice. |
| `attributes.add` | Extra key-value pairs to include in each span or access log entry. Each value is a CEL expression. |

Neither exporter sets a `path` field, so agentgateway uses the default OTLP/HTTP paths, `/v1/traces` for traces and `/v1/logs` for access logs. Axiom expects both of these paths.

The `llm.input_messages` and `llm.output_messages` attributes export the prompt and the completion. Reading `llm.prompt` and `llm.completion` causes agentgateway to inspect the request and response bodies, so omit these attributes if you do not want to export message content.

## Export metrics

Agentgateway exposes Prometheus metrics on port `15020`. Install an OpenTelemetry Collector that discovers the annotated agentgateway proxy pods, scrapes their metrics, and exports the metrics to Axiom over OTLP/HTTP.

Unlike traces and access logs, Axiom requires the `x-axiom-metrics-dataset` header for metrics.

```yaml
helm upgrade --install axiom-metrics-collector opentelemetry-collector \
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
- name: AXIOM_AUTHORIZATION
  valueFrom:
    secretKeyRef:
      name: axiom-credentials
      key: authorization
- name: AXIOM_METRICS_DATASET
  valueFrom:
    secretKeyRef:
      name: axiom-credentials
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
    otlphttp/axiom:
      endpoint: https://${AXIOM_DOMAIN}
      headers:
        Authorization: "\${env:AXIOM_AUTHORIZATION}"
        x-axiom-metrics-dataset: "\${env:AXIOM_METRICS_DATASET}"
  service:
    pipelines:
      metrics:
        receivers: [prometheus/agentgateway]
        processors: [memory_limiter, batch]
        exporters: [otlphttp/axiom]
EOF
```

Two kinds of variable appear in this command, and the difference matters.

* `${AXIOM_DOMAIN}` has no backslash, so your shell substitutes the value before Helm reads the file.
* `\${env:AXIOM_AUTHORIZATION}` is escaped, so the value reaches the collector's configuration file unchanged. The collector then resolves it from the environment variable that `extraEnvs` sets from the Secret. This way, the token stays out of the Helm release.

The `memory_limiter` and `batch` processors come from the chart's default configuration. For production deployments, review the collector's resource requests, memory limiter, batching, and replica count for your expected telemetry volume.

## Get the gateway address

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Verify the integration

1. Verify that Kubernetes accepted both backends and attached the policy to the Gateway.

   ```sh
   kubectl get agentgatewaybackend axiom-traces axiom-logs \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get agentgatewaypolicy axiom-observability \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Both backends report `ACCEPTED=True`. The policy reports `ACCEPTED=True` and `ATTACHED=True`.

2. Verify that the metrics collector is running.

   ```sh
   kubectl rollout status deployment/axiom-metrics-collector-opentelemetry-collector \
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
           "content": "Reply with exactly: Axiom observability works"
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

5. In Axiom, verify each signal.

   - Click **Stream**, and select the traces Events dataset. Open the event that has the trace ID. Click **Find trace** to open the trace waterfall after Axiom recognizes the dataset as an OpenTelemetry trace dataset. Axiom also automatically creates an **OpenTelemetry Traces** dashboard for the dataset.
   - Click **Stream**, select the access logs Events dataset, and find an access log that has the same trace ID.
   - Click **Query**, select the metrics dataset, and query an agentgateway metric such as `agentgateway_gen_ai_client_token_usage`. The **Stream** view does not support Metrics datasets.

{{< reuse-image src="img/axiom-agentgateway-trace-details.jpg" srcDark="img/axiom-agentgateway-trace-details.jpg" alt="Axiom trace event details showing an agentgateway trace ID, OpenAI model, token usage, and LLM input and output" caption="An agentgateway LLM trace in Axiom with request and response attributes." >}}

{{< reuse-image src="img/axiom-agentgateway-metrics-query.jpg" srcDark="img/axiom-agentgateway-metrics-query.jpg" alt="Axiom Query Builder displaying agentgateway generative AI client token usage metric results" caption="Agentgateway LLM token usage metrics queried in Axiom." >}}

Agentgateway and the collector batch their exports, so allow several seconds for new data to appear. Automatic dashboards and trace-dataset detection can take longer than event ingestion.

## Troubleshoot the integration

- Confirm that `AXIOM_DOMAIN` contains only the ingest hostname for the edge deployment that holds your datasets, without a scheme such as `https://` and without a trailing path.
- Confirm that the Basic API token has ingest access to all three datasets.
- Confirm that the traces and access logs datasets use the Events kind and that the metrics dataset uses the Metrics kind.
- Use `x-axiom-dataset` for traces and access logs, and `x-axiom-metrics-dataset` for metrics.
- Confirm that no other policy configures the same telemetry signal on the Gateway.

  ```sh
  kubectl get agentgatewaypolicy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```

  An Axiom policy and a previous observability policy can both report `ATTACHED=True`, even though only one trace exporter takes effect. Remove the previous policy, or combine the required settings into one policy.
- Check the `ACCEPTED` and `ATTACHED` status columns for the backends and the policy.
- Check the proxy logs for OTLP trace or access-log exporter errors.

  ```sh
  kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
    | grep -Ei 'opentelemetry|otlp|export'
  ```

- Check the collector logs for metrics scrape or export errors.

  ```sh
  kubectl logs deployment/axiom-metrics-collector-opentelemetry-collector \
    -n {{< reuse "agw-docs/snippets/namespace.md" >}}
  ```

For more information, see the [Axiom OpenTelemetry documentation](https://axiom.co/docs/send-data/opentelemetry).

## Cleanup

```sh
kubectl delete agentgatewaypolicy axiom-observability -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete agentgatewaybackend axiom-traces axiom-logs -n {{< reuse "agw-docs/snippets/namespace.md" >}}
helm uninstall axiom-metrics-collector -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret axiom-credentials -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
