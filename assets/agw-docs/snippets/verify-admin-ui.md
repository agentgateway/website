## Verify in the Admin UI {#verify-admin-ui}

You can also confirm that the proxy received your configuration in the read-only [Admin UI]({{< link-hextra path="/observability/ui/" >}}). In Kubernetes mode, the UI reflects the configuration that the agentgateway controller pushes to the proxy, so it is a quick way to check that your resources took effect.

1. Forward port 15000 from the `agentgateway-proxy` deployment to your local machine.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

2. While the port-forward is running, open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

3. From the **Traffic** menu, click **Routes**. Find your route, and click the view (eye) icon in its row to inspect the route and backend details.
