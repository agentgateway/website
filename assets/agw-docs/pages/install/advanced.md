You can update several installation settings in your Helm values file. For example, you can update the namespace, set resource limits and requests, or enable extensions such as for AI.

* **Show all values**: 
      
  ```sh
  helm show values {{< reuse "/agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}
  ```

* **Get a file with all values**: You can get a `{{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}/values.yaml` file for the upgrade version by pulling and inspecting the Helm chart locally.
      
  ```sh
  helm pull {{< reuse "/agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}
  tar -xvf {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}-{{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}.tgz
  open {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}/values.yaml
  ```

For more information, see the [Helm reference docs]({{< link-hextra path="/reference/helm/" >}}).

{{< conditional-text include-if="kubernetes" >}}

## Development builds

When using the development build {{< reuse "agw-docs/versions/patch-dev.md" >}}, add `--set controller.image.pullPolicy=Always` to ensure you get the latest image. For production environments, this setting is not recommended as it might impact performance.

{{< /conditional-text >}}

## Experimental Gateway API features {#experimental-gateway-api-features}

To use experimental Gateway API features, you must enable the experimental feature gate, `KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES`. This setting defaults to `false` and must be explicitly enabled to use experimental features such as the following:

- CORS policies
- Retries
- Session persistence

To enable these features, set the environment variable in your kgateway controller deployment in your Helm values file.

```yaml
controller:
  extraEnv:
    KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES: "true"
```




## Leader election

Leader election is enabled by default to ensure that you can run {{< reuse "agw-docs/snippets/kgateway.md" >}} in a multi-control plane replica setup for high availability. 

You can disable leader election by setting the `controller.disableLeaderElection` to `true` in your Helm chart. 

```yaml
controller:
  disableLeaderElection: true
```

{{< version include-if="1.4.x,1.5.x" >}}
## Multiple control planes {#multiple-control-planes}

You can run multiple independent {{< reuse "agw-docs/snippets/kgateway.md" >}} control planes in the same cluster. This setup is different from running multiple replicas of one control plane for high availability. Each independent control plane manages its own GatewayClass and set of Gateways.

Use the following configuration for each additional control plane.

* Install the control plane in a separate namespace. The namespace separates namespaced Helm resources and leader election leases.
* Set a unique `gatewayClassName`. GatewayClasses are cluster-scoped, so their names must be unique across the cluster.
* Set a unique `controllerName`. The controller reconciles only GatewayClasses whose `spec.controllerName` matches this value.
* Optionally, set `discoveryNamespaceSelectors` to limit the namespaces that the control plane watches for gateway configuration.

{{< callout type="warning" >}}
Change `gatewayClassName` and `controllerName` together. If an additional installation changes only `controllerName`, both installations try to manage the default `agentgateway` GatewayClass. Installing the control planes in separate namespaces does not prevent this conflict because GatewayClasses are cluster-scoped.
{{< /callout >}}

For example, label the workload namespaces that the second control plane manages.

```sh
kubectl label namespace tenant-b gateway-controller=tenant-b
```

Create a `secondary-values.yaml` file for the second control plane.

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

Include the control plane's own namespace when you configure namespace discovery. The controller watches resources in that namespace, including the certificate that secures its xDS connection.

Install the second control plane. Install the {{< reuse "agw-docs/snippets/kgateway.md" >}} and Kubernetes Gateway API custom resource definitions (CRDs) only once per cluster.

```sh
helm upgrade --install agentgateway-tenant-b \
  {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
  --create-namespace \
  --namespace agentgateway-tenant-b-system \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  --values secondary-values.yaml
```

Gateways for the second control plane must reference its GatewayClass.

```yaml
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
```

Verify that each GatewayClass has the expected controller name.

```sh
kubectl get gatewayclass \
  -o custom-columns='NAME:.metadata.name,CONTROLLER:.spec.controllerName'
```

If you do not configure `discoveryNamespaceSelectors`, each control plane watches gateway configuration in all namespaces. The unique controller and GatewayClass names still separate ownership, but they do not provide namespace-level discovery isolation. If you enable proxy monitoring, also add the custom GatewayClass to `monitoring.proxy.gatewayClassNames` for that installation.
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

<!-- TODO conditional-text oss-only -->
{{< conditional-text include-if="kubernetes" >}}
## TLS encryption {#tls-encryption}

You can enable TLS encryption for the xDS gRPC server in the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. For more information, see the [TLS encryption]({{< link-hextra path="/install/tls" >}}) docs.
{{< /conditional-text >}}
