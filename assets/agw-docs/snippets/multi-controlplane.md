## Multiple control planes {#multiple-control-planes}

You can run multiple independent {{< reuse "agw-docs/snippets/agentgateway.md" >}} control planes in the same cluster. This setup is different from running multiple replicas of one control plane for high availability. Each independent control plane manages its own GatewayClass and set of Gateways.

Each additional control plane needs the following Helm settings.

| Setting | Description |
| -- | -- |
| Release namespace | Install each control plane in a separate namespace. The namespace separates the namespaced Helm resources and the leader election leases. |
| `gatewayClassName` | A unique GatewayClass name. GatewayClasses are cluster-scoped, so their names must be unique across the cluster. |
| `controllerName` | A unique controller name. The controller reconciles only the GatewayClasses whose `spec.controllerName` matches this value. |
| `discoveryNamespaceSelectors` | Optional. The namespaces that the control plane watches for gateway configuration. Omit to watch all namespaces. |

> [!WARNING]
> Change `gatewayClassName` and `controllerName` together. If an additional installation changes only `controllerName`, both installations try to manage the default `agentgateway` GatewayClass. Separate release namespaces do not prevent this conflict, because GatewayClasses are cluster-scoped.

The following steps add a second control plane for a `tenant-b` team. The {{< reuse "agw-docs/snippets/agentgateway.md" >}} and {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} custom resource definitions (CRDs) are cluster-scoped, so you install them only once per cluster and not again for each control plane.

1. Create the namespace for the workloads and Gateways that the second control plane manages, and label it so that the second control plane discovers it.

   ```sh
   kubectl create namespace tenant-b
   kubectl label namespace tenant-b gateway-controller=tenant-b
   ```

2. Create a `secondary-values.yaml` file for the second control plane. Each entry in `discoveryNamespaceSelectors` is disjunctive (OR semantics), so the control plane watches a namespace if that namespace matches any entry. This example matches two sets of namespaces: the control plane's own namespace, `agentgateway-tenant-b-system`, and every namespace with the `gateway-controller: tenant-b` label. Include the control plane's own namespace, because the controller watches resources in that namespace, such as the certificate that secures its xDS connection.

   ```yaml
   gatewayClassName: agentgateway-tenant-b
   controllerName: agentgateway.dev/agentgateway-tenant-b

   discoveryNamespaceSelectors:
   - matchExpressions:
     - key: kubernetes.io/metadata.name
       operator: In
       values:
       - agentgateway-tenant-b-system
   - matchLabels:
       gateway-controller: tenant-b
   ```

3. Install the second control plane in its own namespace.

   ```sh
   helm upgrade -i --create-namespace \
   -n agentgateway-tenant-b-system agentgateway-tenant-b {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
   --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
   -f secondary-values.yaml
   ```

4. Verify that each control plane owns its own GatewayClass.

   ```sh
   kubectl get gatewayclass -o custom-columns='NAME:.metadata.name,CONTROLLER:.spec.controllerName'
   ```

   Example output:

   ```console
   NAME                    CONTROLLER
   agentgateway            agentgateway.dev/agentgateway
   agentgateway-tenant-b   agentgateway.dev/agentgateway-tenant-b
   ```

5. Create a Gateway that references the GatewayClass of the second control plane.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: tenant-b-gateway
     namespace: tenant-b
   spec:
     gatewayClassName: agentgateway-tenant-b
     listeners:
     - name: http
       protocol: HTTP
       port: 80
   EOF
   ```

6. Verify that the second control plane provisions the proxy for the Gateway.

   ```sh
   kubectl get gateway,pods -n tenant-b
   ```

   Example output:

   ```console
   NAME                                                 CLASS                   ADDRESS   PROGRAMMED   AGE
   gateway.gateway.networking.k8s.io/tenant-b-gateway   agentgateway-tenant-b             True         12s

   NAME                                   READY   STATUS    RESTARTS   AGE
   pod/tenant-b-gateway-766895c6d-zkpxt   1/1     Running   0          12s
   ```

> [!NOTE]
> If you omit `discoveryNamespaceSelectors`, each control plane watches gateway configuration in all namespaces. The unique controller and GatewayClass names still separate ownership, but they do not isolate discovery by namespace. If you enable proxy monitoring, also add the custom GatewayClass to `monitoring.proxy.gatewayClassNames` for that installation.