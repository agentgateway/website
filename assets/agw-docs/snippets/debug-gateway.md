1. Make sure that the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane and gateway proxies are running. For any pod that is not running, describe the pod for more details.
   
   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   
2. Check the HTTPRoutes for the status of the route and any attached policies. For more information about how routes work, review the [Gateway API docs](https://gateway-api.sigs.k8s.io/reference/api-types/httproute/).
   
   ```sh
   kubectl get httproutes -A
   ```
   ```sh
   kubectl get httproute <name> -n <namespace> -o yaml
   ```

   Some common issues to check for:

   * The wrong backend is selected.
   * The wrong gateway is selected.
   * Several HTTPRoutes conflict by having the same matchers or by having none (and thus default to match on everything `/`).


3. Access the debugging interface of your gateway proxy on your localhost. Configuration might be missing on the gateway or might be applied to the wrong route. For example, if you apply multiple policies to the same route by using the `targetRefs` section, only the oldest policy is applied. The newer policy configuration might be ignored and not applied to the gateway.

   ```sh
   kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &
   ```

   Open your browser to the following endpoints.

   | Endpoint | Description|
   | -- | -- |
   | [http://localhost:15000/config_dump](http://localhost:15000/config_dump) | Get the configuration that is available in the agentgateway proxy. Any custom resources that you create are translated in to agentgateway configuration. Depending on whether or not you enabled resource validation, you might have applied invalid configuration that is rejected in agentgateway. |
   | [http://localhost:15000/ui](http://localhost:15000/ui) | A read-only user interface to review the agentgateway resources in your environment, such as listeners, routes, backends, and policies. |

   {{< reuse-image-light src="img/agw-ui-landing.png" caption="Figure: Read-only agentgateway UI.">}}
   {{< reuse-image-dark srcDark="img/agw-ui-landing-dark.png" caption="Figure: Read-only agentgateway UI.">}}

4. Review the logs for each component. Each component logs the sync loops that it runs, such as syncing with various environment signals like the Kubernetes API. You can fetch the latest logs for all the components with the following commands.

   ```sh
   # {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployment/{{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}}

   # Replace $GATEWAY_NAME with the name of your gateway.
   export GATEWAY_NAME=agentgateway-proxy
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deployment/$GATEWAY_NAME
   ```
