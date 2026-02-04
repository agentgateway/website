Use built-in tools to troubleshoot issues in your {{< reuse "/agw-docs/snippets/kgateway.md" >}} setup.

{{< reuse "/agw-docs/snippets/kgateway-capital.md" >}} consists of the control plane and an {{< reuse "/agw-docs/snippets/data-plane.md" >}} data plane. If you experience issues in your environment, such as policies that are not applied or traffic that is not routed correctly, in a lot of cases, these errors can be observed at the proxy.

## Debug the control plane {#control-plane}

1. Enable port-forwarding on the control plane.

   ```sh
   kubectl port-forward deploy/{{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} 9095
   ```

2. In your browser, open the admin server debugging interface: [http://localhost:9095/](http://localhost:9095/).

   {{< reuse-image src="img/admin-server-debug-ui.png" caption="Figure: Admin server debugging interface.">}}
   {{< reuse-image-dark srcDark="img/admin-server-debug-ui.png" caption="Figure: Admin server debugging interface.">}}

3. Select one of the endpoints to continue debugging. {{< reuse "agw-docs/snippets/review-table.md" >}} 

   | Endpoint | Description |
   | -- | -- |
   | `/debug/pprof` | View the pprof profile of the control plane. A profile shows you the stack traces of the call sequences, such as Go routines, that led to particular events, such as memory allocation. The endpoint includes descriptions of each available profile.|
   | `/logging` | Review the current logging levels of each component in the control plane. You can also interactively set the log level by component, such as to enable `DEBUG` logs. |
   | `/snapshots/krt` | View the current krt snapshot, or the point-in-time view of the transformed Kubernetes resources and their sync status that the control plane processed. These resources are then used to generate gateway configuration that is sent to the gateway proxies for routing decisions. |
   | `/snapshots/xds` | The xDS snapshot is used for Envoy-based kgateway proxies, not agentgateway proxies. | 

## Debug your gateway setup

{{< reuse "agw-docs/snippets/debug-gateway.md" >}}

<!-- TODO: CLI
## Before you begin

If you have not done yet, install the `{{< reuse "agw-docs/snippets/cli-name.md" >}}` CLI. The `{{< reuse "agw-docs/snippets/cli-name.md" >}}` CLI is a convenient tool that helps you gather important information about your gateway proxy. To install the `{{< reuse "agw-docs/snippets/cli-name.md" >}}`, you run the following command: 
```sh
curl -sL https://run.solo.io/gloo/install | sh
export PATH=$HOME/.gloo/bin:$PATH
```

{{< callout type="info" >}}
Make sure to use the version of `{{< reuse "agw-docs/snippets/cli-name.md" >}}` that matches your installed version.
{{< /callout >}}

-->

<!-- TODO: CLI
5. Check the proxy configuration that is served by the kgateway xDS server. When you create kgateway resources, these resources are translated into Envoy configuration and sent to the xDS server. If kgateway resources are configured correctly, the configuration must be included in the proxy configuration that is served by the xDS server. 
   ```sh
   {{< reuse "agw-docs/snippets/cli-name.md" >}} proxy served-config --name http
   ```

6. Review the logs for each component. Each component logs the sync loops that it runs, such as syncing with various environment signals like the Kubernetes API. You can fetch the latest logs for all the components with the following command. 
   ```bash
   {{< reuse "agw-docs/snippets/cli-name.md" >}} debug logs
   # save the logs to a file
   {{< reuse "agw-docs/snippets/cli-name.md" >}} debug logs -f gloo.log
   # only print errors
   {{< reuse "agw-docs/snippets/cli-name.md" >}} debug logs --errors-only
   ```
   
   You can use the `kubectl logs` command to view logs for individual components. 
   ```bash
   kubectl logs -f -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l kgateway=kgateway
   ```

   To follow the logs of other kgateway components, simply change the value of the `gloo` label as shown in the table below.

   | Component | Command |
   | ------------- | ------------- |
   | Gloo control plane | `kubectl logs -f -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l kgateway=kgateway` |
   | kgateway proxy {{< callout type="info" >}}To view logs for incoming requests to your gateway proxy, be sure to <a href="/docs/security/access-logging/" >enable access logging</a> first.{{< /callout >}}| `kubectl logs -f -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l gloo=kube-gateway` |
   | Redis | `kubectl logs -f -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l gloo=redis` |

7. If you still cannot troubleshoot the issue, capture the logs and the state of kgateway in a file. 
   ```bash
   {{< reuse "agw-docs/snippets/cli-name.md" >}} debug logs -f gloo-logs.log
   {{< reuse "agw-docs/snippets/cli-name.md" >}} debug yaml -f gloo-yamls.yaml
   ```
   -->
