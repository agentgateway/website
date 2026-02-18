1. Make sure that the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane and gateway proxies are running. For any pod that is not running, describe the pod for more details.
   
   ```she
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   
2. Check the HTTPRoutes for the status of the route and any attached policies.
   
   ```sh
   kubectl get httproutes -A
   ```
   ```sh
   kubectl get httproute <name> -n <namespace> -o yaml
   ```

3. Access the debugging interface of your gateway proxy on your localhost. Configuration might be missing on the gateway or might be applied to the wrong route. For example, if you apply multiple policies to the same route by using the `targetRefs` section, only the oldest policy is applied. The newer policy configuration might be ignored and not applied to the gateway.

<<<<<<< kkb-retries
   {{< /conditional-text >}}

   {{< conditional-text include-if="kubernetes" >}}
   ```sh
   kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &  
   ```

   Open your browser to the following endpoint.

   | Endpoint | Description| 
   | -- | -- | 
   | [http://localhost:15000/config_dump](http://localhost:15000/config_dump) | Get the configuration that is available in the agentgateway proxy. Any custom resources that you create are translated in to agentgateway configuration. Depending on whether or not you enabled resource validation, you might have applied invalid configuration that is rejected in agentgateway. | 


   {{< /conditional-text >}}
   
   {{< conditional-text include-if="agentgateway" >}}
=======
>>>>>>> main
   ```sh
   kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &  
   ```

   Open your browser to the following endpoints.

   | Endpoint | Description| 
   | -- | -- | 
   | [http://localhost:15000/config_dump](http://localhost:15000/config_dump) | Get the configuration that is available in the agentgateway proxy. Any custom resources that you create are translated in to agentgateway configuration. Depending on whether or not you enabled resource validation, you might have applied invalid configuration that is rejected in agentgateway. | 
   | [http://localhost:15000/ui](http://localhost:15000/ui) | A read-only user interface to review the agentgateway resources in your environment, such as listeners, routes, backends, and policies. | 

   {{< reuse-image src="img/agw-ui-landing.png" caption="Figure: Read-only agentgateway UI.">}}
   {{< reuse-image-dark srcDark="img/agw-ui-landing-dark.png" caption="Figure: Read-only agentgateway UI.">}}

4. Review the logs for each component. Each component logs the sync loops that it runs, such as syncing with various environment signals like the Kubernetes API.
