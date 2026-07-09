<!-- Install-path design (decided 2026-07, PR #702): the install is split into two channel-keyed bundles, and the agentgateway build is tied to the channel.
Standard = released build (helm-version-flag) + standard Gateway API CRDs (k8s-gw-version) + no experimental feature gate.
Experimental = nightly build (patch-dev) + experimental Gateway API CRDs at the newest version (k8s-gw-version-exp) + feature gate on.
Why bundled: the nightly build watches TCPRoute at v1, which only Gateway API 1.6 serves; the released v1.3.x build watches v1alpha2, so the Standard path stays on Gateway API 1.5. That is why Experimental uses its own newer Gateway API version (k8s-gw-version-exp) instead of k8s-gw-version.
Revisit when the current main (1.4.x) ships as the next latest: the Standard path will then also move to the v1 / Gateway API 1.6 era, and Standard vs Experimental Gateway API versions may converge. -->
1. Deploy the Kubernetes Gateway API CRDs. 

   <!--The `--force-conflicts` flag is included to prevent field ownership conflicts if Gateway API CRDs were previously installed by another tool.-->

   {{< tabs >}}
   {{% tab name="Standard" %}}
   ```sh {paths="standard"}
   kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/standard-install.yaml
   ```
   {{% /tab %}}
   {{% tab name="Experimental" %}}
   CRDs in the experimental channel are required to use some experimental features in the Gateway API. Guides that require experimental CRDs note this requirement in their prerequisites.
   ```sh {paths="experimental"}
   kubectl apply --server-side --force-conflicts -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Deploy the CRDs for the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane by using Helm.

   {{< tabs >}}
   {{% tab name="Standard" %}}
   ```sh {paths="standard"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "agw-docs/snippets/helm-path-crds.md" >}} \
   --create-namespace --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
   --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
   --set controller.image.pullPolicy=Always
   ```
   {{% /tab %}}
   {{% tab name="Experimental" %}}
   The experimental path uses the nightly development build of the {{< reuse "agw-docs/snippets/kgateway.md" >}} CRDs.
   ```sh {paths="experimental"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "agw-docs/snippets/helm-path-crds.md" >}} \
   --create-namespace --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
   --version {{< reuse "agw-docs/versions/patch-dev.md" >}} \
   --set controller.image.pullPolicy=Always
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Install the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane by using Helm.

   {{< tabs >}}
   {{% tab name="Standard" %}}
   ```sh {paths="standard"}
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "agw-docs/snippets/helm-path.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --set controller.image.pullPolicy=Always \
     --wait
   ```
   {{% /tab %}}
   {{% tab name="Experimental" %}}
   The experimental path uses the nightly development build and enables the experimental Gateway API feature gate, `--set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true`.
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
