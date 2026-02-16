1. **Important**: Install the experimental channel of the Kubernetes Gateway API to use this feature.

   ```shell
   kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/experimental-install.yaml
   ```

2. Deploy the CRDs for the agentgateway control plane by using Helm.
   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway-crds.md" >}} oci://ghcr.io/kgateway-dev/charts/agentgateway-crds \
   --create-namespace --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
   --version v{{< reuse "agw-docs/versions/patch-dev.md" >}} \
   --set controller.image.pullPolicy=Always
   ```

3. **Important**: To use experimental Gateway API features in kgateway, you must enable the `KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES` environment variable in your kgateway controller deployment. This setting defaults to `false` and must be explicitly enabled. For more information, see the [Get started guide]({{< link-hextra path="/quickstart/">}}) to install kgateway.
   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} oci://ghcr.io/kgateway-dev/charts/agentgateway \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version v{{< reuse "agw-docs/versions/patch-dev.md" >}} \
     --set controller.image.pullPolicy=Always \
     --set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true
   ```

4. Follow the [Sample app guide]({{< link-hextra path="/install/sample-app/" >}}) to create a gateway proxy with an HTTP listener and deploy the httpbin sample app.

5. Get the external address of the gateway and save it in an environment variable.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2"  >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} http -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS  
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing"  %}}
   ```sh
   kubectl port-forward deployment/http -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:8080
   ```
   {{% /tab %}}
   {{< /tabs >}}