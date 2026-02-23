Create an HTTP listener on your gateway proxy. Your proxy listens for HTTP traffic on the specified port and hostname that you configure.

## Before you begin

1. Deploy the [httpbin sample app]({{< link-hextra path="/install/sample-app/" >}}).

2. {{% reuse "agw-docs/snippets/prereq-listenerset.md" %}}

   **ListenerSets**: To use ListenerSets, you must install the experimental channel of the Kubernetes Gateway API. 
   ```sh
   kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v{{< reuse "agw-docs/versions/k8s-gw-version.md" >}}/experimental-install.yaml
   ```

   You must also ensure that you installed {{< reuse "agw-docs/snippets/kgateway.md" >}} with the `--set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true` Helm flag to use experimental Kubernetes Gateway API features. For an example, see the [Get started guide]({{< link-hextra path="/quickstart" >}}).
   
## Set up an HTTP listener {#setup-http}

Set up an HTTP listener on your Gateway. 

1. Create a Gateway resource with an HTTP listener. 
   
   {{< tabs items="Gateway listeners,ListenerSets (experimental)" tabTotal="2" >}}
   {{% tab tabName="Gateway listeners" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-proxy-http
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     listeners:
     - protocol: HTTP
       port: 80
       name: http
       allowedRoutes:
         namespaces:
           from: All
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}
   
   |Setting|Description|
   |---|---|
   |`spec.gatewayClassName`|The name of the Kubernetes GatewayClass that you want to use to configure the Gateway. When you set up {{< reuse "agw-docs/snippets/kgateway.md" >}}, a default GatewayClass is set up for you.  |
   |`spec.listeners`|Configure the listeners for this Gateway. In this example, you configure an HTTP Gateway that listens for incoming traffic on port 80. The Gateway can serve HTTPRoutes from any namespace. |

   {{% /tab %}}
   {{% tab tabName="ListenerSets (experimental)" %}}

   1. Create a Gateway that enables the attachment of ListenerSets.

      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: Gateway
      metadata:
        name: agentgateway-proxy-http
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      spec:
        gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
        allowedListeners:
          namespaces:
            from: All        
        listeners:
        - protocol: HTTP
          port: 8080
          name: http-mock
          allowedRoutes:
            namespaces:
              from: All
      EOF
      ```
   
      {{< reuse "agw-docs/snippets/review-table.md" >}}
   
      |Setting|Description|
      |---|---|
      |`spec.gatewayClassName`|The name of the Kubernetes GatewayClass that you want to use to configure the Gateway. When you set up {{< reuse "agw-docs/snippets/kgateway.md" >}}, a default GatewayClass is set up for you. |
      |`spec.allowedListeners`|Enable the attachment of ListenerSets to this Gateway. The example allows listeners from any namespace, which is helpful in multitenant environments. You can also limit the allowed listeners. To limit to listeners in the same namespace as the Gateway, set this value to `Same`. To limit to listeners with a particular label, set this value to `Selector`. |
      |`spec.listeners`| {{< reuse "agw-docs/snippets/generic-listener.md" >}} In this example, the generic listener is configured on port 8080, which differs from port 80 in the ListenerSet that you create later. |

   2. Create a ListenerSet that configures an HTTP listener for the Gateway.

      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.x-k8s.io/v1alpha1
      kind: XListenerSet
      metadata:
        name: http-listenerset
        namespace: httpbin
      spec:
        parentRef:
          name: agentgateway-proxy-http
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          kind: Gateway
          group: gateway.networking.k8s.io
        listeners:
        - protocol: HTTP
          port: 80
          name: http
          allowedRoutes:
            namespaces:
              from: All
      EOF
      ```

      {{< reuse "agw-docs/snippets/review-table.md" >}}

      |Setting|Description|
      |--|--|
      |`spec.parentRef`|The name of the Gateway to attach the ListenerSet to. |
      |`spec.listeners`|Configure the listeners for this ListenerSet. In this example, you configure an HTTP gateway that listens for incoming traffic on port 80. The Gateway can serve HTTPRoutes from any namespace. |

   {{% /tab %}}
   {{< /tabs >}}

2. Check the status of the Gateway to make sure that your configuration is accepted. Note that in the output, a `NoConflicts` status of `False` indicates that the Gateway is accepted and does not conflict with other Gateway configuration. 
   ```sh
   kubectl get gateway agentgateway-proxy-http -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

3. Create an HTTPRoute resource for the httpbin app that is served by the Gateway that you created.
   
   {{< tabs items="Gateway listeners,ListenerSets (experimental)" tabTotal="2" >}}
   {{% tab tabName="Gateway listeners" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-route
     namespace: httpbin
   spec:
     hostnames:
     - listener.example
     parentRefs:
       - name: agentgateway-proxy-http
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```
   {{% /tab %}}
   {{% tab tabName="ListenerSets (experimental)" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-route
     namespace: httpbin
   spec:
     parentRefs:
       - name: http-listenerset
         namespace: httpbin
         kind: XListenerSet
         group: gateway.networking.x-k8s.io
     rules:
       - backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

4. Verify that the HTTPRoute is applied successfully. 
   ```sh
   kubectl get httproute/httpbin-route -n httpbin -o yaml
   ```

   Example output: Notice in the `status` section that the `parentRef` is either the Gateway or the ListenerSet, depending on how you attached the HTTPRoute.

   ```yaml
   ...
   status:
     parents:
     - conditions:
       ...
       parentRef:
         group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy-http
         namespace: agentgateway-system
   ```

5. Verify that the listener now has a route attached.

   {{< tabs items="Gateway listeners,ListenerSet (experimental)" tabTotal="2" >}}
   {{% tab tabName="Gateway listeners" %}}   

   ```sh
   kubectl get gateway -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy-http -o yaml
   ```

   Example output:

   ```yaml
   ...
   listeners:
   - attachedRoutes: 1
   ```
   {{% /tab %}}
   {{% tab tabName="ListenerSets (experimental)" %}}

   ```sh
   kubectl get xlistenerset -n httpbin http-listenerset -o yaml
   ```

   Example output:

   ```yaml
   ...
   listeners:
   - attachedRoutes: 1
   ```

   Note that because the HTTPRoute is attached to the ListenerSet, the Gateway does not show the route in its status.

   ```sh
   kubectl get gateway -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy-http -o yaml
   ```

   Example output:

   ```yaml
   ...
   listeners:
   - attachedRoutes: 0
   ```

   If you create another HTTPRoute that attaches to the Gateway and uses the same listener as the ListenerSet, then the route is reported in the status of both the Gateway (attachedRoutes: 1) and the ListenerSet (attachedRoutes: 2).

   {{% /tab %}}
   {{< /tabs >}}

6. Get the external address of the gateway and save it in an environment variable.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy-http -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS   
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy-http -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

7. Send a request to the httpbin app and verify that you get back a 200 HTTP response code. 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/status/200 -H "host: listener.example" 
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/status/200 -H "host: listener.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   

   Example output: 
   ```console
   * Mark bundle as not supporting multiuse
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < date: Fri, 03 Nov 2023 20:02:48 GMT
   date: Fri, 03 Nov 2023 20:02:48 GMT
   < content-length: 0
   content-length: 0
   < x-envoy-upstream-service-time: 1
   x-envoy-upstream-service-time: 1
   < server: envoy
   server: envoy
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

{{< tabs items="Gateway listeners,ListenerSet (experimental)" tabTotal="2" >}}
{{% tab tabName="Gateway listeners" %}}
```sh
kubectl delete gateway agentgateway-proxy-http -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute httpbin-route -n httpbin
```
{{% /tab %}}
{{% tab tabName="ListenerSet (experimental)" %}}
```sh
kubectl delete gateway agentgateway-proxy-http -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute httpbin-route -n httpbin
kubectl delete xlistenersets http-listenerset -n httpbin
```
{{% /tab %}}
{{< /tabs >}}





