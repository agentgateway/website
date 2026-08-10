1. **Important**: Install the experimental channel of the Kubernetes Gateway API to use this feature.
   ```shell
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```

2. Optional: Gateway API experimental features are controlled by the `AGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES` environment variable in the {{< reuse "agw-docs/snippets/kgateway.md" >}} controller. This setting is enabled by default, so you do not have to change anything. To set it explicitly, such as to make the setting visible in your Helm values, [upgrade]({{< link-hextra path="/operations/upgrade/" >}}) or [install]({{< link-hextra path="/install/" >}}) {{< reuse "agw-docs/snippets/kgateway.md" >}} with the following flag.
   
   Example command:
   ```sh
   helm upgrade -i {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} {{< reuse "agw-docs/snippets/helm-path.md" >}}  \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --set controller.image.pullPolicy=Always \
     --set controller.extraEnv.AGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES=true
   ```

3. [Set up an agentgateway proxy]({{< link-hextra path="/setup/gateway/">}}).

4. Follow the [Sample app guide]({{< link-hextra path="/install/sample-app/" >}}) to deploy the httpbin sample app

5. Get the external address of the gateway and save it in an environment variable.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS  
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}