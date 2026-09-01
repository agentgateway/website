
[Datadog](https://www.datadoghq.com/) is a cloud-based observability platform. You can use the Datadog Agent to forward traces from {{< reuse "agw-docs/snippets/agentgateway.md" >}} to Datadog.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Install the Datadog Agent

1. Add the Datadog Helm repository.

   ```sh
   helm repo add datadog https://helm.datadoghq.com
   helm repo update
   ```

2. Create a Datadog API key secret.

   ```sh
   kubectl create secret generic datadog-secret \
     --from-literal=api-key=<your-datadog-api-key>
   ```

3. Install the Datadog Agent with OTLP ingestion enabled.

   ```sh
   helm install datadog-agent datadog/datadog \
     --namespace datadog \
     --create-namespace \
     --set datadog.apiKeyExistingSecret=datadog-secret \
     --set datadog.otlp.receiver.protocols.grpc.enabled=true \
     --set datadog.otlp.receiver.protocols.grpc.endpoint=0.0.0.0:4317
   ```

## Configure tracing

Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points the agentgateway proxy at the Datadog Agent.

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
        name: datadog-agent
        namespace: datadog
        port: 4317
      protocol: GRPC
      randomSampling: "true"
EOF
```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the {{< reuse "agw-docs/snippets/policy.md" >}} resource.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} tracing -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Uninstall the Datadog Agent.
   ```sh
   helm uninstall datadog-agent -n datadog
   kubectl delete namespace datadog
   ```
