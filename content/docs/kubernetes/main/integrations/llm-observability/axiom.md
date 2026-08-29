---
title: Axiom
weight: 5
description: Export agentgateway traces, access logs, and metrics to Axiom.
test: skip
---

[Axiom](https://axiom.co/) is an observability platform that accepts OpenTelemetry traces, logs, and metrics. Agentgateway can export traces and access logs directly to Axiom over OTLP/HTTP. An OpenTelemetry Collector scrapes the agentgateway Prometheus endpoint and forwards metrics to Axiom.

## Before you begin

1. [Install agentgateway]({{< link-hextra path="/quickstart/install/" >}}) in your Kubernetes cluster.
2. [Set up an agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
3. Set up an [LLM provider]({{< link-hextra path="/llm/providers/" >}}) and route in agentgateway.
4. Install the `kubectl` and `helm` command-line tools.
5. Sign up for an [Axiom account](https://app.axiom.co/).

## Create the Axiom datasets and API token

Axiom requires a dedicated dataset for each OpenTelemetry signal. Create two Events datasets for traces and logs, and one Metrics dataset for metrics.

1. Log in to the [Axiom dashboard](https://app.axiom.co/).
2. Go to **Settings** > **Datasets and views**, and click **New dataset**.
3. Create the following datasets. You can use different names.

   | Example name | Kind | Signal |
   |--------------|------|--------|
   | `agentgateway-traces` | Events | Traces |
   | `agentgateway-logs` | Events | Access logs |
   | `agentgateway-metrics` | Metrics | Metrics |

4. Go to **Settings** > **API tokens**, and click **New API token**.
5. Give the token a name, select **Basic**, and grant it access to all three datasets.
6. Create the token and copy it immediately. Axiom does not display the token again.

{{< reuse-image src="img/axiom-agentgateway-api-token.jpg" srcDark="img/axiom-agentgateway-api-token.jpg" alt="Axiom API token settings showing ingest access limited to the agentgateway logs, metrics, and traces datasets" caption="A Basic Axiom API token scoped to the three agentgateway telemetry datasets." >}}

7. Save the token and dataset names in environment variables. Do not commit these values to source control.

   ```sh
   export AXIOM_API_TOKEN="<your-api-token>"
   export AXIOM_TRACES_DATASET="agentgateway-traces"
   export AXIOM_LOGS_DATASET="agentgateway-logs"
   export AXIOM_METRICS_DATASET="agentgateway-metrics"
   ```

8. Set the Axiom ingest domain. The following example uses the Axiom Cloud API endpoint. If your datasets use an [edge deployment](https://axiom.co/docs/restapi/introduction#base-domain), set this variable to its base domain instead.

   ```sh
   export AXIOM_DOMAIN="api.axiom.co"
   ```

9. Create a Kubernetes Secret in the same namespace as the agentgateway proxy.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: axiom-credentials
     namespace: agentgateway-system
   type: Opaque
   stringData:
     authorization: "Bearer ${AXIOM_API_TOKEN}"
     traces-dataset: "${AXIOM_TRACES_DATASET}"
     logs-dataset: "${AXIOM_LOGS_DATASET}"
     metrics-dataset: "${AXIOM_METRICS_DATASET}"
   EOF
   ```

The Secret stores the complete bearer-token value that agentgateway and the OpenTelemetry Collector send in the `Authorization` header.

## Export traces and access logs

Create two Axiom backends because the `x-axiom-dataset` header must select a different dataset for each signal. Then, attach an `AgentgatewayPolicy` that exports traces and access logs from the `agentgateway-proxy` Gateway.

> [!IMPORTANT]
> Before you continue, remove or update any existing `AgentgatewayPolicy` that configures tracing or OTLP access-log export for the same Gateway. Multiple policies might report `ATTACHED=True`, but only one exporter configuration for each telemetry signal is effective.

```yaml
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: axiom-traces
  namespace: agentgateway-system
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
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: axiom-logs
  namespace: agentgateway-system
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
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: axiom-observability
  namespace: agentgateway-system
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    tracing:
      backendRef:
        group: agentgateway.dev
        kind: AgentgatewayBackend
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
          kind: AgentgatewayBackend
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

Agentgateway uses `/v1/traces` and `/v1/logs` by default for the respective OTLP/HTTP exporters. The policy also adds the LLM input and output messages. Accessing `llm.prompt` and `llm.completion` causes agentgateway to inspect the request and response bodies, so omit these attributes if you do not want to export message content.

## Export metrics

Agentgateway exposes Prometheus metrics on port `15020`. Install an OpenTelemetry Collector that discovers the annotated agentgateway proxy pods, scrapes their metrics, and exports them to Axiom over OTLP/HTTP.

Unlike traces and logs, Axiom requires the `x-axiom-metrics-dataset` header for metrics.

```yaml
helm upgrade --install axiom-metrics-collector opentelemetry-collector \
  --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
  --version 0.127.2 \
  --set mode=deployment \
  --set image.repository="otel/opentelemetry-collector-contrib" \
  --set command.name="otelcol-contrib" \
  --namespace=agentgateway-system \
  -f -<<EOF
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
        Authorization: "\${AXIOM_AUTHORIZATION}"
        x-axiom-metrics-dataset: "\${AXIOM_METRICS_DATASET}"
  service:
    pipelines:
      metrics:
        receivers: [prometheus/agentgateway]
        processors: [memory_limiter, batch]
        exporters: [otlphttp/axiom]
EOF
```

For production deployments, review the collector's resource requests, memory limiter, batching, and replica count for your expected telemetry volume.

## Verify the integration

1. Verify that Kubernetes accepted both backends and attached the policy to the Gateway.

   ```sh
   kubectl get agentgatewaybackend axiom-traces axiom-logs \
     -n agentgateway-system
   kubectl get agentgatewaypolicy axiom-observability \
     -n agentgateway-system
   ```

   Both backends should report `ACCEPTED=True`. The policy should report `ACCEPTED=True` and `ATTACHED=True`.

2. Verify that the metrics collector is running.

   ```sh
   kubectl rollout status deployment/axiom-metrics-collector-opentelemetry-collector \
     -n agentgateway-system
   ```

3. If you run a local cluster such as Kind, port-forward the agentgateway proxy.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy \
     -n agentgateway-system 8080:80
   ```

4. In a separate terminal, send an LLM request through agentgateway. The following example assumes that the proxy is available on local port `8080` and has an OpenAI-compatible provider and the `gpt-3.5-turbo` model configured.

   ```sh
   curl http://localhost:8080/v1/chat/completions \
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

5. Find the request in the proxy logs and copy its `trace.id` value.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n agentgateway-system \
     | grep 'protocol=llm' \
     | tail -1
   ```

6. In Axiom, verify each signal.

   - Click **Stream**, and select the traces Events dataset. Open the event with the trace ID. Click **Find trace** to open the trace waterfall after Axiom recognizes the dataset as an OpenTelemetry trace dataset. Axiom also automatically creates an **OpenTelemetry Traces** dashboard for the dataset.
   - Click **Stream**, select the logs Events dataset, and find an access log with the same trace ID.
   - Click **Query**, select the metrics dataset, and query an agentgateway metric such as `agentgateway_gen_ai_client_token_usage`. The **Stream** view does not support Metrics datasets.

{{< reuse-image src="img/axiom-agentgateway-trace-details.jpg" srcDark="img/axiom-agentgateway-trace-details.jpg" alt="Axiom trace event details showing an agentgateway trace ID, OpenAI model, token usage, and LLM input and output" caption="An agentgateway LLM trace in Axiom with request and response attributes." >}}

{{< reuse-image src="img/axiom-agentgateway-metrics-query.jpg" srcDark="img/axiom-agentgateway-metrics-query.jpg" alt="Axiom Query Builder displaying agentgateway generative AI client token usage metric results" caption="Agentgateway LLM token usage metrics queried in Axiom." >}}

Export is batched, so allow several seconds for new data to appear. Automatic dashboards and trace-dataset detection can take longer than event ingestion.

## Troubleshoot the integration

- Confirm that `AXIOM_DOMAIN` is the ingest domain for the edge deployment that contains your datasets.
- Confirm that the Basic API token has ingest access to all three datasets.
- Confirm that the traces and logs datasets use the Events kind and the metrics dataset uses the Metrics kind.
- Use `x-axiom-dataset` for traces and logs, and `x-axiom-metrics-dataset` for metrics.
- Confirm that another policy does not configure the same telemetry signal on the Gateway.

  ```sh
  kubectl get agentgatewaypolicy -n agentgateway-system
  ```

  An Axiom policy and a previous observability policy can both report `ATTACHED=True`, even though only one trace exporter is effective. Remove the previous policy or combine the required settings into one policy.
- Check the `ACCEPTED` and `ATTACHED` status columns for the backends and policy.
- Check the proxy logs for OTLP trace or access-log exporter errors.

  ```sh
  kubectl logs deployment/agentgateway-proxy -n agentgateway-system \
    | grep -Ei 'opentelemetry|otlp|export'
  ```

- Check the collector logs for metrics scrape or export errors.

  ```sh
  kubectl logs deployment/axiom-metrics-collector-opentelemetry-collector \
    -n agentgateway-system
  ```

For more information, see the [Axiom OpenTelemetry documentation](https://axiom.co/docs/send-data/opentelemetry).

## Cleanup

```sh
kubectl delete agentgatewaypolicy axiom-observability -n agentgateway-system
kubectl delete agentgatewaybackend axiom-traces axiom-logs -n agentgateway-system
helm uninstall axiom-metrics-collector -n agentgateway-system
kubectl delete secret axiom-credentials -n agentgateway-system
```
