---
title: Export logs over OTLP
weight: 20
description: Export agentgateway access logs as OTLP LogRecord objects to an OpenTelemetry Collector or any compatible backend.
test:
  access-log-otlp:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/observability/access-logs/export.md
    path: access-log-otlp
---

Export access logs to an OpenTelemetry Collector or any OTLP-compatible logging backend. Log export happens in addition to stdout output, so you can send logs to a collector without losing local visibility.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up an OpenTelemetry collector

Install an OpenTelemetry collector that agentgateway can send access logs to.

1. Install the OTel collector.
   ```sh {paths="access-log-otlp"}
   helm upgrade --install opentelemetry-collector-logs opentelemetry-collector \
   --repo https://open-telemetry.github.io/opentelemetry-helm-charts \
   --version 0.127.2 \
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
     exporters:
       debug:
         verbosity: detailed
     service:
       pipelines:
         logs:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug]
   EOF
   ```

   {{< doc-test paths="access-log-otlp" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for OTel collector logs deployment to be ready
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: telemetry
           name: opentelemetry-collector-logs
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

2. Verify that the collector is running.
   ```sh
   kubectl get pods -n telemetry
   ```

   Example output:
   ```console
   NAME                                            READY   STATUS    RESTARTS   AGE
   opentelemetry-collector-logs-7dd46cbb69-kpg7k   1/1     Running   0          30s
   ```

## Configure OTLP log export

Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that points agentgateway at the collector.

```yaml {paths="access-log-otlp"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: access-log-export
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend:
    accessLog:
      otlp:
        backendRef:
          name: opentelemetry-collector-logs
          namespace: telemetry
          port: 4317
        protocol: GRPC
EOF
```

{{< doc-test paths="access-log-otlp" >}}
YAMLTest -f - <<'EOF'
- name: verify access log OTLP policy is accepted
  command:
    command: "kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} access-log-export -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o jsonpath='{.status.ancestors[*].conditions[?(@.type==\"Accepted\")].status}'"
  source:
    type: local
  expect:
    exitCode: 0
    stdout:
      contains: "True"
EOF
{{< /doc-test >}}

## Verify log export

1. Send a request through agentgateway.
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Check the collector logs for the access log record.
   ```sh
   kubectl logs deploy/opentelemetry-collector-logs -n telemetry | grep -A 20 "LogRecord"
   ```

   Each proxied request appears as a `LogRecord` entry with attributes such as `gateway`, `http.method`, `http.path`, and `http.status`.

## Filter logs before export

You can filter which access logs are exported to the OTLP backend using the `otlp.filter` field. When `otlp.filter` is not set, the top-level `accessLog.filter` is used as a fallback for OTLP export as well. When `otlp.filter` is set, it takes precedence over the top-level filter for OTLP export only.

The following example sends only error responses to the OTLP collector while logging all requests to stdout.

```yaml
frontend:
  accessLog:
    otlp:
      backendRef:
        name: opentelemetry-collector-logs
        namespace: telemetry
        port: 4317
      filter: 'response.code >= 400'
```

The following example logs only error responses to stdout but sends all requests to the OTLP collector by setting an explicit `otlp.filter` that always evaluates to `true`.

```yaml
frontend:
  accessLog:
    filter: 'response.code >= 400'
    otlp:
      backendRef:
        name: opentelemetry-collector-logs
        namespace: telemetry
        port: 4317
      filter: 'true'
```

## Customize exported fields

You can add or remove fields in the OTLP export independently from stdout using `otlp.attributes`. When `otlp.attributes` is not set, the top-level `accessLog.attributes` are used.

```yaml
frontend:
  accessLog:
    otlp:
      backendRef:
        name: opentelemetry-collector-logs
        namespace: telemetry
        port: 4317
      attributes:
        add:
        - name: trace_id
          expression: 'request.headers["x-trace-id"]'
        remove:
        - http.host
```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the {{< reuse "agw-docs/snippets/policy.md" >}} resource.
   ```sh {paths="access-log-otlp"}
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} access-log-export -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Uninstall the OpenTelemetry collector.
   ```sh {paths="access-log-otlp"}
   helm uninstall opentelemetry-collector-logs -n telemetry
   ```

3. Remove the `telemetry` namespace.
   ```sh {paths="access-log-otlp"}
   kubectl delete namespace telemetry
   ```
