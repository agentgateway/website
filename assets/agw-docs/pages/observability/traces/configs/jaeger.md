
[Jaeger](https://www.jaegertracing.io/) is an open-source distributed tracing platform. The following steps show you how to install Jaeger in your cluster and configure {{< reuse "agw-docs/snippets/agentgateway.md" >}} to send traces to it.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Install Jaeger

1. Add the Jaeger Helm repository and install Jaeger.

   ```sh
   helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
   helm repo update
   helm install jaeger jaegertracing/jaeger \
     --namespace tracing \
     --create-namespace \
     --set allInOne.enabled=true \
     --set provisionDataStore.cassandra=false \
     --set storage.type=memory
   ```

2. Verify that the Jaeger pod is running.

   ```sh
   kubectl get pods -n tracing
   ```

   Example output:

   ```console
   NAME                      READY   STATUS    RESTARTS   AGE
   jaeger-7f6697849c-8q8vw   1/1     Running   0          50s
   ```

## Configure tracing

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at the Jaeger collector.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
        name: jaeger-collector
        namespace: tracing
        port: 4317
      protocol: GRPC
      randomSampling: "true"
EOF
```

## Verify traces

1. Port-forward the Jaeger UI.

   ```sh
   kubectl port-forward -n tracing svc/jaeger-query 16686:16686
   ```

2. Send a request to the httpbin app.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi -X POST http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi -X POST localhost:8080/post \
    -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Open the Jaeger UI at [http://localhost:16686](http://localhost:16686) and select `agentgateway` as the service. You should see a span for the request you sent.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the {{< reuse "agw-docs/snippets/policy.md" >}} resource.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Uninstall Jaeger.
   ```sh
   helm uninstall jaeger -n tracing
   kubectl delete namespace tracing
   ```
