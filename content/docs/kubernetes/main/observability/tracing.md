---
title: Tracing
weight: 90
test:
  tracing:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/observability/tracing.md
    path: tracing
---

Integrate your agentgateway proxy with an OpenTelemetry (OTel) collector and configure custom metadata for your traces with an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up an OpenTelemetry collector

Install an OpenTelemetry collector that the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy can send traces to. Depending on your environment, you can further configure your OpenTelemetry to export these traces to your preferred tracing platform, such as Jaeger. 

1. Install the OTel collector.
   ```sh {paths="tracing"}
   helm upgrade --install opentelemetry-collector-traces opentelemetry-collector \
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
           http:
             endpoint: 0.0.0.0:4318
     exporters:
       otlp/tempo:
         endpoint: http://tempo.telemetry.svc.cluster.local:4317
         tls:
           insecure: true
       debug:
         verbosity: detailed
     service:
       pipelines:
         traces:
           receivers: [otlp]
           processors: [batch]
           exporters: [debug, otlp/tempo]
   EOF
   ```

   {{< doc-test paths="tracing" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for OTel collector deployment to be ready
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: telemetry
           name: opentelemetry-collector-traces
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}
   
2. Verify that the collector is up and running. 
   ```sh
   kubectl get pods -n telemetry
   ```
   
   Example output: 
   ```console
   NAME                                             READY   STATUS    RESTARTS   AGE
   opentelemetry-collector-traces-8f566f445-l82s6   1/1     Running   0          17m
   ```

## Set up tracing

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your tracing configuration. 
   ```yaml {paths="tracing"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: tracing
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - kind: Gateway
         name: agentgateway-proxy
         group: gateway.networking.k8s.io
     frontend:
       tracing:
         backendRef:
           name: opentelemetry-collector-traces
           namespace: telemetry
           port: 4317
         protocol: GRPC
         clientSampling: "true"
         randomSampling: "true"
         resources:
           - name: deployment.environment.name
             expression: '"production"'
           - name: service.version
             expression: '"test"'
         attributes:
           add:
             - expression: 'request.headers["x-header-tag"]'
               name: request
             - expression: 'request.host'
               name: host
   EOF
   ```

## Verify traces

1. Send a request to the httpbin app with the `x-header-tag` header. 
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi -X POST http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com" \
    -H "x-header-tag: custom-tracing"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi -X POST localhost:8080/post \
    -H "host: www.example.com" \
    -H "x-header-tag: custom-tracing"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="tracing" >}}
   YAMLTest -f - <<'EOF'
   - name: verify tracing setup - POST returns 200
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80"
       path: /post
       method: POST
       headers:
         host: "www.example.com"
         x-header-tag: custom-tracing
     source:
       type: local
     expect:
       statusCode: 200
   EOF
   {{< /doc-test >}}

2. Get the trace ID from your request from the agentgateway proxy logs. 
   ```sh
   kubectl logs deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
   | grep -o 'trace\.id=[^ ]*' | tail -1
   ```

3. Get the logs of the collector and search for the trace ID. Verify that you see the additional tracing attributes that you configured initially.
   ```sh
   kubectl logs deploy/opentelemetry-collector-traces -n telemetry \
   | grep -A 27 "Trace ID\s\+: <trace_id>"
   ```

   Example output: 
   ```console {hl_lines=[27,28]}
   Trace ID       : 2864d2f682a85ba0c44cb5122d2d11e5
    Parent ID      : 
    ID             : 947515b6316f7931
    Name           : POST /*
    Kind           : Server
    Start time     : 2026-01-20 16:28:30.717325796 +0000 UTC
    End time       : 2026-01-20 16:28:30.717960087 +0000 UTC
    Status code    : Unset
    Status message : 
   Attributes:
     -> gateway: Str(agentgateway-system/agentgateway-proxy)
     -> listener: Str(http)
     -> route: Str(httpbin/httpbin)
     -> endpoint: Str(10.244.0.31:8080)
     -> src.addr: Str(127.0.0.1:50314)
     -> http.method: Str(POST)
     -> http.host: Str(www.example.com)
     -> http.path: Str(/post)
     -> http.version: Str(HTTP/1.1)
     -> http.status: Int(200)
     -> trace.id: Str(2864d2f682a85ba0c44cb5122d2d11e5)
     -> span.id: Str(947515b6316f7931)
     -> protocol: Str(http)
     -> duration: Str(0ms)
     -> url.scheme: Str(http)
     -> network.protocol.version: Str(1.1)
     -> request: Str(custom-tracing)
     -> host: Str(www.example.com)

   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Uninstall the OpenTelemetry collector.
   ```sh
   helm uninstall opentelemetry-collector-traces -n telemetry
   ```

3. Remove the `telemetry` namespace.
   ```sh
   kubectl delete namespace telemetry
   ```