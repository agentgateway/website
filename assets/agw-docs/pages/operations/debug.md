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

