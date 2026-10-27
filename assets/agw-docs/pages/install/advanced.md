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

{{< version include-if="main" >}}This version of the docs covers unreleased work, which no released build contains, so every install path in this version installs the development build. The guidance in this section applies to the default installation instructions, not only to an opt-in path. For a production install, use a released version of the docs.{{< /version >}}

{{< /conditional-text >}}

## Experimental Gateway API features {#experimental-gateway-api-features}

Experimental Gateway API features follow the channel of the Gateway API CRDs that you install. To use a feature that is experimental in your Gateway API version, install the experimental channel of the Gateway API CRDs.

For the list of experimental features and the install command, see [Experimental features in Gateway API]({{< link-hextra path="/release-notes/versions/#experimental-features" >}}).

## Leader election

Leader election is enabled by default to ensure that you can run {{< reuse "agw-docs/snippets/kgateway.md" >}} in a multi-control plane replica setup for high availability. 

You can disable leader election by setting the `controller.disableLeaderElection` to `true` in your Helm chart. 

```yaml
controller:
  disableLeaderElection: true
```

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}

{{< reuse "agw-docs/snippets/multi-controlplane.md" >}}

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
{{< version exclude-if="1.1.x" >}}
## TLS encryption {#tls-encryption}

You can enable TLS encryption for the xDS gRPC server in the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane. For more information, see the [TLS encryption]({{< link-hextra path="/documentation/install/tls" >}}) docs.
{{< /version >}}
{{< /conditional-text >}}
