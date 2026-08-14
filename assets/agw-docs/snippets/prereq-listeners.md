1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).

2. Deploy the [httpbin sample app]({{< link-hextra path="/install/sample-app/" >}}).

3. {{% reuse "agw-docs/snippets/prereq-listenerset.md" %}}

   **ListenerSets**: To use ListenerSets in {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} 1.3 or 1.4, install the experimental channel.
   ```sh
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version-exp.md" >}}/experimental-install.yaml
   ```