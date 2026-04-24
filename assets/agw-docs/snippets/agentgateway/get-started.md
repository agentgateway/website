1. Deploy the Kubernetes Gateway API CRDs. 

   <!--The `--force-conflicts` flag is included to prevent field ownership conflicts if Gateway API CRDs were previously installed by another tool.-->

   {{< tabs items="Standard, Experimental" tabTotal="2" >}}
   {{% tab tabName="Standard" %}}
   ```sh {paths="standard"}
   kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml
   ```
   {{% /tab %}}
   {{% tab tabName="Experimental" %}}
   CRDs in the experimental channel are required to use some experimental features in the Gateway API. Guides that require experimental CRDs note this requirement in their prerequisites.
   ```sh {paths="experimental"}
   kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Deploy the CRDs for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane by using Helm.

   {{< tabs items="Release, Nightly build" tabTotal="2" >}}
   {{% tab tabName="Release" %}}
   ```sh {paths="standard"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "agw-docs/snippets/helm-path-crds.md" >}} \
   --create-namespace --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
   --version v{{< reuse "agw-docs/versions/n-patch.md" >}} \
   --set controller.image.pullPolicy=Always
   ```
   {{% /tab %}}
   {{% tab tabName="Nightly build" %}}
   For testing and development purposes, you can use the nightly build of the {{< reuse "agw-docs/snippets/kgateway.md" >}} CRDs.
   ```sh {paths="experimental"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "agw-docs/snippets/helm-path-crds.md" >}} \
   --create-namespace --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
   --version {{< reuse "agw-docs/versions/patch-dev.md" >}} \
   --set controller.image.pullPolicy=Always
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Install the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane by using Helm. To use experimental Gateway API features, include the experimental feature gate, `--set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true`.

   {{< tabs items="Release, Nightly build" tabTotal="2" >}}
   {{% tab tabName="Release" %}}
   ```sh {paths="standard"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "agw-docs/snippets/helm-path.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version v{{< reuse "agw-docs/versions/n-patch.md" >}} \
     --set controller.image.pullPolicy=Always \
     --set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true \
     --wait
   ```
   {{% /tab %}}
   {{% tab tabName="Nightly build" %}}
   For testing and development purposes, you can use the nightly build of the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane.
   ```sh {paths="experimental"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "agw-docs/snippets/helm-path.md" >}} \
   --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
   --version {{< reuse "agw-docs/versions/patch-dev.md" >}} \
   --set controller.image.pullPolicy=Always \
   --set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true \
   --wait
   ```
   {{% /tab %}}
   {{< /tabs >}}

4. Make sure that the `{{< reuse "agw-docs/snippets/pod-name.md" >}}` control plane is running.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```console
   NAME                        READY   STATUS    RESTARTS   AGE
   {{< reuse "agw-docs/snippets/pod-name.md" >}}-5495d98459-46dpk   1/1     Running   0          19s
   ```