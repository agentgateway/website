Create an HTTPS listener on your agentgateway proxy so that your proxy listens for secured HTTPS traffic.

## Before you begin

{{< reuse "agw-docs/snippets/cert-prereqs.md" >}}

## Create a TLS certificate

{{< reuse "agw-docs/snippets/listeners-https-create-cert.md" >}}

## Set up an HTTPS listener {#setup-https}

Set up an HTTPS listener on your Gateway. 

1. Create a Gateway resource with an HTTPS listener. The following Gateway listener terminates incoming TLS traffic on port 443 by using the TLS certificates that you created earlier. 

   {{< tabs items="Gateway listeners,ListenerSets (experimental)" tabTotal="2" >}}
   {{% tab tabName="Gateway listeners" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: https
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       example: httpbin-https
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     listeners:
     - protocol: HTTPS
       port: 443
       name: https
       tls:
         mode: Terminate
         certificateRefs:
           - name: https
             kind: Secret
       allowedRoutes:
         namespaces:
           from: All
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   |Setting|Description|
   |---|---|
   |`spec.gatewayClassName`|The name of the Kubernetes GatewayClass that you want to use to configure the Gateway. When you set up {{< reuse "agw-docs/snippets/kgateway.md" >}}, a default GatewayClass is set up for you.  |
   |`spec.listeners`|Configure the listeners for this Gateway. The Gateway can serve HTTPS routes from any namespace. |
   |`spec.listeners.tls.mode`|The TLS mode that you want to use for incoming requests. In this example, HTTPS requests are terminated at the Gateway and the unencrypted request is forwarded to the service in the cluster. |
   |`spec.listeners.tls.certificateRefs`|The Kubernetes secret that holds the TLS certificate and key for the Gateway. The Gateway uses these credentials to establish the TLS connection with a client, and to decrypt incoming HTTPS requests.|

   {{% /tab %}}
   {{% tab tabName="ListenerSets (experimental)" %}}

   1. Create a Gateway that enables the attachment of ListenerSets.

      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.k8s.io/v1
      kind: Gateway
      metadata:
        name: https
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        labels:
          example: httpbin-https
      spec:
        gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
        allowedListeners:
          namespaces:
            from: All        
        listeners:
        - protocol: HTTP
          port: 80
          name: http-mock
          allowedRoutes:
            namespaces:
              from: All
      EOF
      ```

      {{< reuse "agw-docs/snippets/review-table.md" >}}

      |Setting|Description|
      |---|---|
      |`spec.gatewayClassName`|The name of the Kubernetes GatewayClass that you want to use to configure the Gateway. When you set up {{< reuse "agw-docs/snippets/kgateway.md" >}}, a default GatewayClass is set up for you.  |
      |`spec.allowedListeners`|Enable the attachment of ListenerSets to this Gateway. The example allows listeners from any namespace, which is helpful in multitenant environments. You can also limit the allowed listeners. To limit to listeners in the same namespace as the Gateway, set this value to `Same`. To limit to listeners with a particular label, set this value to `Selector`. |
      |`spec.listeners`| {{< reuse "agw-docs/snippets/generic-listener.md" >}} In this example, the generic listener is configured on port 80, which differs from port 443 in the ListenerSet that you create later. |

   2. Create a ListenerSet that configures an HTTPS listener for the Gateway.
      ```yaml
      kubectl apply -f- <<EOF
      apiVersion: gateway.networking.x-k8s.io/v1alpha1
      kind: XListenerSet
      metadata:
        name: my-https-listenerset
        namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
        labels:
          example: httpbin-https
      spec:
        parentRef:
          name: https
          namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
          kind: Gateway
          group: gateway.networking.k8s.io
        listeners:
        - protocol: HTTPS
          port: 443
          hostname: https.example.com
          name: https-listener-set
          tls:
            mode: Terminate
            certificateRefs:
              - name: https
                kind: Secret
          allowedRoutes:
            namespaces:
              from: All
      EOF
      ```

      {{< reuse "agw-docs/snippets/review-table.md" >}}

      |Setting|Description|
      |--|--|
      |`spec.parentRef`|The name of the Gateway to attach the ListenerSet to. |
      |`spec.listeners`|Configure the listeners for this ListenerSet. In this example, you configure an HTTPS gateway that listens for incoming traffic for the `https.example.com` domain on port 443. The gateway can serve HTTP routes from any namespace. |
      |`spec.listeners.tls.mode`|The TLS mode that you want to use for incoming requests. In this example, HTTPS requests are terminated at the gateway and the unencrypted request is forwarded to the service in the cluster. |
      |`spec.listeners.tls.certificateRefs`|The Kubernetes secret that holds the TLS certificate and key for the gateway. The gateway uses these credentials to establish the TLS connection with a client, and to decrypt incoming HTTPS requests.|

   {{% /tab %}}
   {{< /tabs >}}

2. Check the status of the Gateway to make sure that your configuration is accepted. Note that in the output, a `NoConflicts` status of `False` indicates that the Gateway is accepted and does not conflict with other Gateway configuration. 
   ```sh
   kubectl get gateway https -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
   ```

3. Create an HTTPRoute resource for the httpbin app that is served by the Gateway or ListenerSet that you created.
   
   {{< tabs items="Gateway listeners,ListenerSets (experimental)" tabTotal="2" >}}
   {{% tab tabName="Gateway listeners" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-https
     namespace: httpbin
     labels:
       example: httpbin-https
   spec:
     hostnames:
       - https.example.com
     parentRefs:
       - name: https
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
     name: httpbin-https
     namespace: httpbin
     labels:
       example: httpbin-https
   spec:
     parentRefs:
       - name: my-https-listenerset
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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
   kubectl get httproute/httpbin-https -n httpbin -o yaml
   ```

   Example output: Notice in the `status` section that the parentRef is either the Gateway or the ListenerSet, depending on how you attached the HTTPRoute.

   ```yaml
   ...
   status:
   ...
     parentRef:
       group: gateway.networking.k8s.io
       kind: Gateway
       name: https
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

5. Verify that the listener now has a route attached.

   {{< tabs items="Gateway listeners,ListenerSet (experimental)" tabTotal="2" >}}
   {{% tab tabName="Gateway listeners" %}}   

   ```sh
   kubectl get gateway -n {{< reuse "agw-docs/snippets/namespace.md" >}} https -o yaml
   ```

   Example output:

   ```yaml
   ...
   listeners:
   - attachedRoutes: 1
   ```
   {{% /tab %}}
   {{% tab tabName="ListenerSet (experimental)" %}}

   ```sh
   kubectl get xlistenerset -n {{< reuse "agw-docs/snippets/namespace.md" >}} my-https-listenerset -o yaml
   ```

   Example output:

   ```yaml
   ...
   listeners:
   - attachedRoutes: 1
   ```

   Note that because the HTTPRoute is attached to the ListenerSet, the Gateway does not show the route in its status.

   ```sh
   kubectl get gateway -n {{< reuse "agw-docs/snippets/namespace.md" >}} https -o yaml
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
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} https -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS   
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward svc/https -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8443:443
   ```
   {{% /tab %}}
   {{< /tabs >}}

7. Send a request to the httpbin app and verify that you see the TLS handshake and you get back a 200 HTTP response code. 
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vik --resolve "https.example.com:443:${INGRESS_GW_ADDRESS}" https://https.example.com:443/status/200
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vik --connect-to https.example.com:443:localhost:8443 https://https.example.com:443/status/200
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   * Added https.example.com:443:172.18.0.5 to DNS cache
   * Hostname https.example.com was found in DNS cache
   *   Trying 172.18.0.5:443...
   * Connected to https.example.com (172.18.0.5) port 443
   * ALPN: curl offers h2,http/1.1
   * (304) (OUT), TLS handshake, Client hello (1):
   * (304) (IN), TLS handshake, Server hello (2):
   * (304) (IN), TLS handshake, Unknown (8):
   * (304) (IN), TLS handshake, Certificate (11):
   * (304) (IN), TLS handshake, CERT verify (15):
   * (304) (IN), TLS handshake, Finished (20):
   * (304) (OUT), TLS handshake, Finished (20):
   * SSL connection using TLSv1.3 / AEAD-AES256-GCM-SHA384 / [blank] / UNDEF
   * ALPN: server accepted h2
   * Server certificate:
   *  subject: CN=*.example.com; O=any domain
   *  issuer: O=any domain; CN=*
   *  SSL certificate verify result: unable to get local issuer certificate (20), continuing anyway.
   * using HTTP/2
   * [HTTP/2] [1] OPENED stream for https://https.example.com:443/status/200
   * [HTTP/2] [1] [:method: GET]
   * [HTTP/2] [1] [:scheme: https]
   * [HTTP/2] [1] [:authority: https.example.com]
   * [HTTP/2] [1] [:path: /status/200]
   * [HTTP/2] [1] [user-agent: curl/8.7.1]
   * [HTTP/2] [1] [accept: */*]
   > GET /status/200 HTTP/2
   > Host: https.example.com
   > User-Agent: curl/8.7.1
   > Accept: */*
   > 
   * Request completely sent off
   < HTTP/2 200 
   HTTP/2 200 
   ...
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

{{< tabs items="Gateway listeners,ListenerSet (experimental)" tabTotal="2" >}}
{{% tab tabName="Gateway listeners" %}}
```sh
kubectl delete -A gateways,httproutes,secret -l example=httpbin-https
rm -rf example_certs
```
{{% /tab %}}
{{% tab tabName="ListenerSet (experimental)" %}}
```sh
kubectl delete -A gateways,httproutes,xlistenersets,secret -l example=httpbin-https
rm -rf example_certs
```
{{% /tab %}}
{{< /tabs >}}





