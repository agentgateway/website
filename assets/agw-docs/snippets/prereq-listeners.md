1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).

2. Deploy the [httpbin sample app]({{< link-hextra path="/install/sample-app/" >}}).

3. {{% reuse "agw-docs/snippets/prereq-listenerset.md" %}}

   **ListenerSets**: To use ListenerSets, you must install the experimental channel of the Kubernetes Gateway API. 
   ```sh
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml
   ```