Customize your agentgateway proxy with the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. 

## Before you begin

Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).

## Customize the gateway

Choose between the following options to customize your agentgateway proxy: 

* [Built-in customization](#built-in)
* [Overlays](#overlays)
* [`rawConfig`](#rawconfig)

### Built-in customization {#built-in}

You can add your custom configuration to the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} custom resource directly. This way, your configuration is validated when you apply the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource in your cluster. 

1. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource with your custom configuration. The following example changes the logging format from `text` to `json`. For other examples, see [Built-in customization]({{< link-hextra path="/setup/customize/configs/#built-in-customization" >}}). 
   ```yaml
   kubectl apply --server-side -f- <<'EOF'
   apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: agentgateway-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     logging:
        format: json
   EOF
   ```

2. Create a Gateway resource that sets up an agentgateway proxy that uses your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}. 

   ```yaml
   kubectl apply --server-side -f- <<'EOF'
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     infrastructure:
       parametersRef:
         name: agentgateway-config
         group: {{< reuse "agw-docs/snippets/gatewayparam-group.md" >}}
         kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}       
     listeners:
       - name: http
         port: 3030
         protocol: HTTP
         allowedRoutes:
           namespaces:
             from: All
   EOF
   ```

3. Check the pod logs to verify that the agentgateway logs are displayed in JSON format. 
   ```sh
   kubectl logs deployment/agentgateway-config -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output: 
   ```
   {"level":"info","time":"2025-12-16T15:58:18.245219Z","scope":"agent_core::readiness","message":"Task 'agentgateway' complete (2.378042ms), still awaiting 1 tasks"}
   {"level":"info","time":"2025-12-16T15:58:18.245221Z","scope":"agentgateway::management::hyper_helpers","message":"listener established","address":"127.0.0.1:15000","component":"admin"}
   {"level":"info","time":"2025-12-16T15:58:18.245231Z","scope":"agentgateway::management::hyper_helpers","message":"listener established","address":"[::]:15020","component":"stats"}
   {"level":"info","time":"2025-12-16T15:58:18.248025Z","scope":"agent_xds::client","message":"Stream established","xds":{"id":1}}
   {"level":"info","time":"2025-12-16T15:58:18.248081Z","scope":"agent_xds::client","message":"received response","type_url":"type.googleapis.com/agentgateway.dev.workload.Address","size":44,"removes":0,"xds":{"id":1}}
   ```

### Overlays {#overlays}

You can add your custom configuration to the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} custom resource directly. This way, your configuration is validated when you apply the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource in your cluster. 

1. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource with your custom configuration. The following example changes the default replica count from 1 to 3. For other examples, see [Overlays]({{< link-hextra path="/setup/customize/configs/#overlays" >}}). 
   ```yaml
   kubectl apply --server-side -f- <<'EOF'
   apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: agentgateway-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     deployment:
       spec:
         replicas: 3
   EOF
   ```

2. Create a Gateway resource that sets up an agentgateway proxy that uses your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}. 

   ```yaml
   kubectl apply --server-side -f- <<'EOF'
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     infrastructure:
       parametersRef:
         name: agentgateway-config
         group: {{< reuse "agw-docs/snippets/gatewayparam-group.md" >}}
         kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}       
     listeners:
       - name: http
         port: 3030
         protocol: HTTP
         allowedRoutes:
           namespaces:
             from: All
   EOF
   ```

3. Check the number of agentgateway pods that are created. Verify that you see 3 replicas. 
   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output: 
   ```
   NAME                                   READY   STATUS    RESTARTS       AGE
   agentgateway-config-54975d9598-qrh8v   1/1     Running   0              7s
   agentgateway-config-54975d9598-tb6qx   1/1     Running   0              7s
   agentgateway-config-54975d9598-w4cx2   1/1     Running   0              7s
   ```

### `rawConfig`

Use the `rawConfig` option to pass in raw upstream configuration to your agentgateway proxy. Note that the configuration is not automatically validated. If configuration is malformatted or includes unsupported fields, the agentgateway proxy does not start. You can run `kubectl logs deploy/agentgateway-proxy -n agentgateway-system` to view the logs of the proxy and find more information about why the configuration could not be applied. 

1. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource with your custom configuration. The following example sets up a simple direct response listener on port 3000 that returns a `200 OK` response with the body `"hello!"` for requests to the `/direct` path.
   ```yaml
   kubectl apply --server-side -f- <<'EOF'
   apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: agentgateway-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     rawConfig:
       binds: 
       - port: 3000
         listeners: 
         - protocol: HTTP
           routes: 
           - name: direct-response
             matches: 
             - path: 
                 pathPrefix: /direct
             policies: 
               directResponse:
                 body: "hello!"
                 status: 200
   EOF
   ```

2. Create a Gateway resource that sets up an agentgateway proxy that uses your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}. Set the port to a dummy value like `3030` to avoid conflicts with the binds defined in your {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

   ```yaml
   kubectl apply --server-side -f- <<'EOF'
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-config
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     infrastructure:
       parametersRef:
         name: agentgateway-config
         group: {{< reuse "agw-docs/snippets/gatewayparam-group.md" >}}  
         kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}       
     listeners:
       - name: http
         port: 3030
         protocol: HTTP
         allowedRoutes:
           namespaces:
             from: All
   EOF
   ```

3. Send a test request.

   * **Cloud Provider LoadBalancer**:
     1. Get the external address of the gateway proxy and save it in an environment variable.
   
     ```sh
     export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-config -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
     echo $INGRESS_GW_ADDRESS
     ```

     2. Send a request along the `/direct` path to the agentgateway proxy through port 3000. 
        ```sh
        curl -i http://$INGRESS_GW_ADDRESS:3000/direct
        ```
   * **Port-forward for local testing**
     1. Port-forward the `agentgateway-config` pod on port 3000.
        ```sh
        kubectl port-forward deployment/agentgateway-config -n {{< reuse "agw-docs/snippets/namespace.md" >}} 3000:3000
        ```

     2. Send a request to verify that you get back the expected response from your direct response configuration.
        ```sh
        curl -i localhost:3000/direct
        ```

   Example output:
   
   ```txt
   HTTP/1.1 200 OK
   content-length: 6
   date: Tue, 28 Oct 2025 14:13:48 GMT
   
   hello!
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}
```sh
kubectl delete Gateway agentgateway-config -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} agentgateway-config -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next

[Explore other common agentgateway proxy configurations]({{< link-hextra path="/setup/customize/configs/" >}}) that you can apply in your environment. 