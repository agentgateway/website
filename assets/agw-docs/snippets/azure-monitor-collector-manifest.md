```sh
if ! jq -en \
  --arg client_id "$COLLECTOR_CLIENT_ID" \
  --arg endpoint "$AZURE_MONITOR_OTLP_TRACES_ENDPOINT" \
  --arg otel_namespace "$OTEL_NAMESPACE" \
  --arg collector "$OTEL_COLLECTOR_NAME" \
  --arg service_account "$OTEL_SERVICE_ACCOUNT" \
  --arg image "$OTEL_COLLECTOR_IMAGE" '
    ($client_id | test("^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$")) and
    ($endpoint | test("^https://[^|&\\\\[:space:]]+$")) and
    ($otel_namespace | test("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) and
    all([$collector, $service_account][];
      test("^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$")) and
    ($image | test("^[A-Za-z0-9][A-Za-z0-9._/:@-]*$"))' >/dev/null; then
  printf 'A Collector manifest substitution value is invalid.\n' >&2
  false
fi &&
kubectl create -f- <<EOF &&
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${OTEL_SERVICE_ACCOUNT}
  namespace: ${OTEL_NAMESPACE}
  annotations:
    azure.workload.identity/client-id: "${COLLECTOR_CLIENT_ID}"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${OTEL_COLLECTOR_NAME}
  namespace: ${OTEL_NAMESPACE}
data:
  collector.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
    processors:
      memory_limiter:
        check_interval: 1s
        limit_mib: 256
        spike_limit_mib: 64
      batch:
        send_batch_size: 512
        timeout: 5s
    extensions:
      health_check:
        endpoint: 0.0.0.0:13133
      azure_auth:
        workload_identity:
          client_id: \${env:AZURE_CLIENT_ID}
          federated_token_file: \${env:AZURE_FEDERATED_TOKEN_FILE}
          tenant_id: \${env:AZURE_TENANT_ID}
        scopes:
          - https://monitor.azure.com/.default
    exporters:
      otlphttp/azuremonitor:
        traces_endpoint: \${env:AZURE_MONITOR_OTLP_TRACES_ENDPOINT}
        auth:
          authenticator: azure_auth
        sending_queue:
          enabled: true
          queue_size: 1000
        retry_on_failure:
          enabled: true
          initial_interval: 5s
          max_interval: 30s
          max_elapsed_time: 300s
    service:
      extensions: [health_check, azure_auth]
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [otlphttp/azuremonitor]
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${OTEL_COLLECTOR_NAME}
  namespace: ${OTEL_NAMESPACE}
  labels:
    app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: ${OTEL_SERVICE_ACCOUNT}
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: collector
          image: ${OTEL_COLLECTOR_IMAGE}
          imagePullPolicy: IfNotPresent
          args: ["--config=/conf/collector.yaml"]
          env:
            - name: AZURE_MONITOR_OTLP_TRACES_ENDPOINT
              value: "${AZURE_MONITOR_OTLP_TRACES_ENDPOINT}"
          ports:
            - name: otlp-grpc
              containerPort: 4317
              protocol: TCP
            - name: health
              containerPort: 13133
              protocol: TCP
          readinessProbe:
            httpGet:
              path: /
              port: health
            initialDelaySeconds: 2
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: health
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 384Mi
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
            readOnlyRootFilesystem: true
          volumeMounts:
            - name: config
              mountPath: /conf
              readOnly: true
      volumes:
      - name: config
        configMap:
          name: ${OTEL_COLLECTOR_NAME}
---
apiVersion: v1
kind: Service
metadata:
  name: ${OTEL_COLLECTOR_NAME}
  namespace: ${OTEL_NAMESPACE}
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: ${OTEL_COLLECTOR_NAME}
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: otlp-grpc
      protocol: TCP
EOF
printf '%s\n' 'Collector objects created.'
```

Expected final output after the checks pass:

```text
Collector objects created.
```

| Field | Description |
| --- | --- |
| `ServiceAccount.metadata.name` and `metadata.namespace` | Produce `system:serviceaccount:${OTEL_NAMESPACE}:${OTEL_SERVICE_ACCOUNT}`, matching `COLLECTOR_SUBJECT`. |
| `ServiceAccount.metadata.annotations.azure.workload.identity/client-id` | Connects the Kubernetes service account to the user-assigned identity. The AKS Workload Identity webhook injects `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_FEDERATED_TOKEN_FILE`. |
| `ConfigMap.data.collector.yaml.receivers.otlp.protocols.grpc` | Listens for OTLP over gRPC on port 4317. |
| `ConfigMap.data.collector.yaml.processors.memory_limiter` | Limits Collector memory pressure before batching spans. |
| `ConfigMap.data.collector.yaml.processors.batch` | Sends batches of up to 512 items or after five seconds. |
| `ConfigMap.data.collector.yaml.extensions.health_check` | Exposes Collector health on port 13133 for the pod probes. |
| `ConfigMap.data.collector.yaml.extensions.azure_auth.workload_identity` | Reads the environment variables injected by AKS Workload Identity. It does not contain a secret. |
| `ConfigMap.data.collector.yaml.extensions.azure_auth.scopes` | Requests a token for the `https://monitor.azure.com/.default` scope. |
| `ConfigMap.data.collector.yaml.exporters.otlphttp/azuremonitor.traces_endpoint` | Sends only traces to the native DCR endpoint constructed earlier. |
| `ConfigMap.data.collector.yaml.exporters.otlphttp/azuremonitor.sending_queue` | Queues up to 1,000 pending batches when export slows down. |
| `ConfigMap.data.collector.yaml.exporters.otlphttp/azuremonitor.retry_on_failure` | Retries temporary export failures for up to five minutes. |
| `ConfigMap.data.collector.yaml.service.pipelines.traces` | Connects the OTLP receiver to the memory and batch processors, then to the Azure Monitor exporter. There are no metric or log pipelines. |
| `Deployment.spec.template.metadata.labels.azure.workload.identity/use` | Activates the AKS Workload Identity mutating webhook for the Collector pod. |
| `Deployment.spec.template.spec.serviceAccountName` | Runs the pod as `OTEL_SERVICE_ACCOUNT`, which the federated credential trusts. |
| `Deployment.spec.template.spec.containers[].image` | Uses `OTEL_COLLECTOR_IMAGE`, defaulting to `otel/opentelemetry-collector-contrib:0.148.0`. Changing the version requires a separate compatibility check; pin an immutable digest in production. |
| `Deployment.spec.template.spec.containers[].env` | Supplies the native OTLP traces endpoint. The webhook adds the three Workload Identity environment variables. |
| `Deployment.spec.template.spec.containers[].readinessProbe` and `livenessProbe` | Check the Collector health extension on port 13133. |
| `Deployment.spec.template.spec.securityContext` | Runs the pod as non-root with the runtime default seccomp profile. |
| `Deployment.spec.template.spec.containers[].securityContext` | Prevents privilege escalation, drops Linux capabilities, and uses a read-only root filesystem. |
| `Deployment.spec.template.spec.containers[].resources` | Requests 50 millicores and 128 MiB, with a memory limit of 384 MiB. Adjust these values after measuring your trace volume. |
| `Service.spec.selector` and `spec.ports[].port` | Select the Collector pod and expose its OTLP gRPC receiver as `${OTEL_COLLECTOR_NAME}.${OTEL_NAMESPACE}.svc.cluster.local:4317`. |
