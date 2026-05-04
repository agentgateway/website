In this installation guide, you install {{< reuse "/agw-docs/snippets/kgateway.md" >}} in a Kubernetes cluster by using [Flux](https://fluxcd.io/). Flux is a CNCF-graduated, GitOps-based continuous delivery tool that reconciles cluster state from a Git repository or OCI registry. This approach uses the `agentgateway` Helm charts that are published as OCI artifacts to `cr.agentgateway.dev`.

## Before you begin

1. Create or use an existing Kubernetes cluster.
2. Install the following command-line tools.
   * [`kubectl`](https://kubernetes.io/docs/tasks/tools/#kubectl), the Kubernetes command line tool. Download the `kubectl` version that is within one minor version of the Kubernetes clusters you plan to use.
3. If you do not already have Flux installed in your cluster, install it by following the [Flux installation guide](https://fluxcd.io/flux/installation/). You can use the `flux` CLI, the [Flux Operator](https://fluxoperator.dev/), or any other supported method.

## Install

Install {{< reuse "/agw-docs/snippets/kgateway.md" >}} by using Flux. The following steps use `kubectl apply` so you can try the procedure quickly, but in a GitOps workflow you would commit the same manifests to the Git or OCI source that Flux reconciles and let the controllers apply them for you.

1. Create a `gateway-api` namespace and install the custom resources of the {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} version {{< reuse "agw-docs/versions/k8s-gw-version.md" >}} by creating a `GitRepository` source and a `Kustomization` that reconciles the `standard` CRD channel from the upstream repository.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Namespace
   metadata:
     name: gateway-api
   ---
   apiVersion: source.toolkit.fluxcd.io/v1
   kind: GitRepository
   metadata:
     name: gateway-api
     namespace: gateway-api
   spec:
     interval: 1h
     url: https://github.com/kubernetes-sigs/gateway-api
     ref:
       tag: v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}
     sparseCheckout:
       - config/crd/standard
   ---
   apiVersion: kustomize.toolkit.fluxcd.io/v1
   kind: Kustomization
   metadata:
     name: gateway-api
     namespace: gateway-api
   spec:
     interval: 1h
     prune: true
     sourceRef:
       kind: GitRepository
       name: gateway-api
     path: ./config/crd/standard
   EOF
   ```

   {{< callout type="info" >}}If you need to use an experimental feature such as TCPRoutes, reconcile the experimental channel by setting `sparseCheckout: [config/crd/experimental]` on the `GitRepository` and `path: ./config/crd/experimental` on the `Kustomization`. For more information, see [Experimental features in Gateway API]({{< link-hextra path="/reference/versions/#experimental-features">}}).{{< /callout >}}

2. Create the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace and the `OCIRepository` and `HelmRelease` resources that install the {{< reuse "/agw-docs/snippets/kgateway.md" >}} CRD and control plane charts into it. You might also need the following values:
   * **Development builds**: `controller.image.pullPolicy=Always` to ensure you get the latest image.
   * **Experimental Gateway API features**: `controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true` to enable experimental features such as TCPRoutes.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Namespace
   metadata:
     name: {{< reuse "agw-docs/snippets/namespace.md" >}}
   ---
   apiVersion: source.toolkit.fluxcd.io/v1
   kind: OCIRepository
   metadata:
     name: {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}}
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     interval: 5m
     url: oci://cr.agentgateway.dev/charts/{{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}}
     ref:
       tag: {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
   ---
   apiVersion: helm.toolkit.fluxcd.io/v2
   kind: HelmRelease
   metadata:
     name: {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}}
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     interval: 5m
     releaseName: {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}}
     chartRef:
       kind: OCIRepository
       name: {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}}
     upgrade:
       strategy:
         name: RetryOnFailure
         retryInterval: 5m
   ---
   apiVersion: source.toolkit.fluxcd.io/v1
   kind: OCIRepository
   metadata:
     name: {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     interval: 5m
     url: oci://cr.agentgateway.dev/charts/{{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}
     ref:
       tag: {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
   ---
   apiVersion: helm.toolkit.fluxcd.io/v2
   kind: HelmRelease
   metadata:
     name: {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     dependsOn:
       - name: {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}}
     interval: 5m
     releaseName: {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}
     chartRef:
       kind: OCIRepository
       name: {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}
     upgrade:
       strategy:
         name: RetryOnFailure
         retryInterval: 5m
     values:
       controller:
         image:
           pullPolicy: Always
         extraEnv:
           KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES: "true"
   EOF
   ```

3. Verify that the `HelmRelease` resources reconcile successfully.

   ```sh
   kubectl get helmrelease -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:
   ```txt
   NAME                AGE   READY   STATUS
   agentgateway        2m    True    Helm install succeeded for release agentgateway-system/agentgateway.v1
   agentgateway-crds   2m    True    Helm install succeeded for release agentgateway-system/agentgateway-crds.v1
   ```

4. Verify that the control plane is up and running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:
   ```txt
   NAME                             READY   STATUS    RESTARTS   AGE
   {{< reuse "agw-docs/snippets/pod-name.md" >}}-6b5bb4db6b-c2pkq   1/1     Running   0          4m4s
   ```

5. Verify that the `{{< reuse "/agw-docs/snippets/gatewayclass.md" >}}` GatewayClass is created. You can optionally take a look at how the GatewayClass is configured by adding the `-o yaml` option to your command.

   ```sh
   kubectl get gatewayclass {{< reuse "/agw-docs/snippets/gatewayclass.md" >}}
   ```

## Next steps

Now that you have {{< reuse "/agw-docs/snippets/kgateway.md" >}} set up and running, check out the following guides to expand your gateway capabilities.

- [Set up your agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
- Review the [LLM consumption]({{< link-hextra path="/llm/" >}}), [inference routing]({{< link-hextra path="/inference/" >}}), [MCP]({{< link-hextra path="/mcp/" >}}), or [agent connectivity]({{< link-hextra path="/agent/" >}}) guides to learn more about common agentgateway use cases.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

Follow the [Uninstall with Flux guide]({{< link-hextra path="/operations/uninstall#flux">}}).
