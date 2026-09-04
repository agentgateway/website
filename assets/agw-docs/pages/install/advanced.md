You can update several installation settings in your Helm values file. For example, you can update the namespace, set resource limits and requests, or enable extensions such as for AI.

* **Show all values**: 
      
  ```sh
  helm show values {{< reuse "/agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}
  ```

* **Get a file with all values**: You can get a `{{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}}/values.yaml` file for the upgrade version by pulling and inspecting the Helm chart locally.
      
  ```sh
  helm pull {{< reuse "/agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}
  tar -xvf {{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}}-{{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}.tgz
  open {{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}}/values.yaml
  ```

For more information, see the [Helm reference docs]({{< link-hextra path="/reference/helm/" >}}).

{{< conditional-text include-if="kubernetes" >}}

## Development builds

When using the development build {{< reuse "agw-docs/versions/patch-dev.md" >}}, add `--set controller.image.pullPolicy=Always` to ensure you get the latest image. For production environments, this setting is not recommended as it might impact performance.

{{< /conditional-text >}}

## Experimental Gateway API features {#experimental-gateway-api-features}

Experimental Gateway API features are controlled by the experimental feature gate, `AGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES`. This setting is enabled by default, so experimental features such as the following are available without any extra configuration:

- CORS policies
- Retries
- Session persistence

To set the feature gate explicitly, such as to make the setting visible in your Helm values or to turn experimental features off, set the environment variable in your {{< reuse "agw-docs/snippets/kgateway.md" >}} controller deployment in your Helm values file.

```yaml
controller:
  extraEnv:
    AGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES: "true"
```




## Leader election

Leader election is enabled by default to ensure that you can run {{< reuse "agw-docs/snippets/kgateway.md" >}} in a multi-control plane replica setup for high availability. 

You can disable leader election by setting the `controller.disableLeaderElection` to `true` in your Helm chart. 

```yaml
controller:
  disableLeaderElection: true
```

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
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
{{< /version >}}

{{< version exclude-if="2.2.x,1.0.x,1.1.x" >}}
## Namespace discovery {#namespace-discovery}

You can limit the namespaces that {{< reuse "/agw-docs/snippets/kgateway.md" >}} watches for gateway configuration. For example, you might have a multi-tenant cluster with different namespaces for different tenants. You can limit {{< reuse "/agw-docs/snippets/kgateway.md" >}} to only watch a specific namespace for gateway configuration.

Namespace selectors are a list of matched expressions or labels.

* `matchExpressions`: Use this field for more complex selectors where you want to specify an operator such as `In` or `NotIn`.
* `matchLabels`: Use this field for simple selectors where you want to specify a label key-value pair.

Each entry in the list is disjunctive (OR semantics). This means that a namespace is selected if it matches any selector.

You can also use matched expressions and labels together in the same entry, which is conjunctive (AND semantics).

The following example selects namespaces for discovery that meet either of the following conditions:

* The namespace has the label `environment=prod` and the label `version=v2`, or
* The namespace has the label `version=v3`

```yaml
discoveryNamespaceSelectors:
- matchExpressions:
  - key: environment
    operator: In
    values:
    - prod
  matchLabels:
    version: v2
- matchLabels:
    version: v3
```

{{< /version >}}

<!-- Gated by excluding the older versions, not by including "main", so the
     section stays put when the next release freezes this line under a number.
     Only OSS versions need listing: solo-io/docs reaches this file through
     the rebase shortcode, which passes the OSS version its ossDir points at, so
     every
     enterprise line resolves to one of the tokens above. -->
{{< version exclude-if="1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}

## Istio resource discovery {#istio-discovery}

By default, the ClusterRole for the {{< reuse "agw-docs/snippets/agentgateway.md" >}} control plane includes permission to read Istio ServiceEntry and WorkloadEntry resources, so that the controller can discover mesh services and workloads. In a cluster that does not have the Istio custom resource definitions (CRDs) installed, that rule refers to resources that do not exist. Set `istio.enabled` to `false` to leave the rule out.

```yaml
istio:
  enabled: false
```

Keep the following behavior in mind:

* The value controls RBAC generation only. It does not turn off Istio integration in the controller. To change whether gateways join the mesh, use `istio.autoEnabled`, or the `spec.istio` section of an `AgentgatewayParameters` resource.
* Helm accepts a value that the installed chart does not define, so this setting has no effect on a chart version that predates it. After you upgrade, confirm that the rule is gone. The chart names the ClusterRole after the release namespace, so adjust the name if you installed into a different namespace.

  ```sh
  kubectl get clusterrole agentgateway-{{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml | grep networking.istio.io
  ```

  A command that returns no output means that the rule is no longer granted.

{{< /version >}}

<!-- TODO conditional-text oss-only -->
{{< conditional-text include-if="kubernetes" >}}
## TLS encryption {#tls-encryption}

You can enable TLS encryption for the xDS gRPC server in the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. For more information, see the [TLS encryption]({{< link-hextra path="/install/tls" >}}) docs.
{{< /conditional-text >}}
