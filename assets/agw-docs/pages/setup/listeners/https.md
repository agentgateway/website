Create an HTTPS listener on your agentgateway proxy so that your proxy listens for secured HTTPS traffic.

## Before you begin

{{< reuse "agw-docs/snippets/cert-prereqs.md" >}}

## Create a TLS certificate

{{< reuse "agw-docs/snippets/listeners-https-create-cert.md" >}}

## Set up an HTTPS listener {#setup-https}

Set up an HTTPS listener on your Gateway. 

1. Create a Gateway resource with an HTTPS listener. The following Gateway listener terminates incoming TLS traffic on port 443 by using the TLS certificates that you created earlier. 

   {{< tabs >}}
   {{% tab name="Gateway listeners" %}}
   ```yaml {paths="https-listener"}
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
       port: 8443
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
   {{% tab name="ListenerSets" %}}
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
      apiVersion: gateway.networking.k8s.io/v1
      kind: ListenerSet
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
          port: 8443
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
   
   {{< tabs >}}
   {{% tab name="Gateway listeners" %}}
   ```yaml {paths="https-listener"}
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
   {{% tab name="ListenerSets" %}}
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
       - name: my-https-listenerset
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
         kind: ListenerSet
         group: gateway.networking.k8s.io
     rules:
       - backendRefs:
           - name: httpbin
             port: 8000
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

{{< doc-test paths="https-listener" >}}
YAMLTest -f - <<'EOF'
- name: wait for https deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: https
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for https service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: agentgateway-system
        name: https
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for httpbin-https HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: httpbin
        name: httpbin-https
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

export INGRESS_GW_ADDRESS_HTTPS=$(kubectl get svc -n agentgateway-system https -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
{{< /doc-test >}}

{{< doc-test paths="https-listener" >}}
for i in $(seq 1 90); do
  code=$(curl -sk --max-time 30 --resolve "https.example.com:8443:${INGRESS_GW_ADDRESS_HTTPS}" -o /dev/null -w "%{http_code}" https://https.example.com:8443/status/200 || true)
  [ "$code" = "200" ] && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="https-listener" >}}
HTTP_CODE=$(curl -sk --max-time 30 --resolve "https.example.com:8443:${INGRESS_GW_ADDRESS_HTTPS}" -o /dev/null -w "%{http_code}" https://https.example.com:8443/status/200)
echo "HTTPS listener returned status code: ${HTTP_CODE}"
test "${HTTP_CODE}" = "200"
{{< /doc-test >}}

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

   {{< tabs >}}
   {{% tab name="Gateway listeners" %}}   

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
   {{% tab name="ListenerSet" %}}

   ```sh
   kubectl get listenerset -n {{< reuse "agw-docs/snippets/namespace.md" >}} my-https-listenerset -o yaml
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
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} https -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS   
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward svc/https -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8443:8443
   ```
   {{% /tab %}}
   {{< /tabs >}}

7. Send a request to the httpbin app and verify that you see the TLS handshake and you get back a 200 HTTP response code. 
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vik --resolve "https.example.com:8443:${INGRESS_GW_ADDRESS}" https://https.example.com:8443/status/200
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vik --connect-to https.example.com:8443:localhost:8443 https://https.example.com:8443/status/200
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

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Share the HTTPS port with a TLS passthrough listener {#tls-passthrough-shared-port}

An HTTPS listener and a TLS passthrough listener can share a port on one Gateway, such as port 443. The proxy reads the Server Name Indication (SNI) hostname of each TLS connection and selects the listener that claims it. The HTTPS listener terminates TLS at the gateway. The TLS listener passes the encrypted connection through to a backend that terminates TLS itself, such as a service that manages its own certificates or requires end-to-end mutual TLS.

Without a shared port, passthrough traffic needs a second Gateway, and often a second load balancer and IP address. The two listeners must claim different hostnames. For the rules that decide which listener wins a conflict, see [Listener precedence]({{< link-hextra path="/documentation/setup/listeners/overview/#listener-precedence" >}}).

The following steps reuse the root certificate, the `https` Secret, and the httpbin app from the previous sections.

1. Create a server certificate for the `passthrough.example.com` hostname, signed by the root certificate that you created earlier. The passthrough backend presents this certificate, not the gateway.
   ```sh
   openssl req -new -nodes -newkey rsa:2048 \
     -keyout example_certs/passthrough.key -out example_certs/passthrough.csr \
     -subj "/CN=passthrough.example.com"
   printf "subjectAltName=DNS:passthrough.example.com\n" > example_certs/passthrough.ext
   openssl x509 -req -sha256 -days 365 \
     -CA example_certs/root.crt -CAkey example_certs/root.key -set_serial 1 \
     -in example_certs/passthrough.csr -out example_certs/passthrough.crt \
     -extfile example_certs/passthrough.ext
   ```

   Example output of the last command:
   ```console
   Certificate request self-signature ok
   subject=CN=passthrough.example.com
   ```

2. Store the certificate in a Secret in the `httpbin` namespace, where the passthrough backend runs.
   ```sh
   kubectl create secret tls passthrough-server-certs -n httpbin \
     --key example_certs/passthrough.key \
     --cert example_certs/passthrough.crt
   kubectl label secret passthrough-server-certs -n httpbin example=httpbin-https
   ```

   Example output:
   ```console
   secret/passthrough-server-certs created
   secret/passthrough-server-certs labeled
   ```

3. Deploy an nginx server that terminates TLS with that certificate.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: passthrough-nginx
     namespace: httpbin
   data:
     nginx.conf: |
       events {}
       http {
         server {
           listen 8443 ssl;
           server_name passthrough.example.com;
           ssl_certificate /etc/nginx-server-certs/tls.crt;
           ssl_certificate_key /etc/nginx-server-certs/tls.key;
           location / {
             default_type text/plain;
             return 200 "hello from the TLS passthrough backend\n";
           }
         }
       }
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: passthrough-nginx
     namespace: httpbin
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: passthrough-nginx
     template:
       metadata:
         labels:
           app: passthrough-nginx
       spec:
         containers:
         - name: nginx
           image: nginx:1.27
           ports:
           - containerPort: 8443
           volumeMounts:
           - name: config
             mountPath: /etc/nginx/nginx.conf
             subPath: nginx.conf
             readOnly: true
           - name: certs
             mountPath: /etc/nginx-server-certs
             readOnly: true
         volumes:
         - name: config
           configMap:
             name: passthrough-nginx
         - name: certs
           secret:
             secretName: passthrough-server-certs
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: passthrough-nginx
     namespace: httpbin
   spec:
     selector:
       app: passthrough-nginx
     ports:
     - name: https
       port: 443
       targetPort: 8443
   EOF
   ```

   Example output:
   ```console
   configmap/passthrough-nginx created
   deployment.apps/passthrough-nginx created
   service/passthrough-nginx created
   ```

4. Create a Gateway with an HTTPS listener and a TLS passthrough listener on port 443.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: https-passthrough
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       example: httpbin-https
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     listeners:
     - name: https
       protocol: HTTPS
       port: 443
       hostname: https.example.com
       tls:
         mode: Terminate
         certificateRefs:
         - name: https
           kind: Secret
       allowedRoutes:
         namespaces:
           from: All
     - name: tls-passthrough
       protocol: TLS
       port: 443
       hostname: passthrough.example.com
       tls:
         mode: Passthrough
       allowedRoutes:
         namespaces:
           from: All
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   |Setting|Description|
   |---|---|
   |`spec.listeners[].port`|Both listeners use port 443. Only an `HTTPS` listener and a `TLS` listener can share a port this way. Any other mix of protocols on one port is a `ProtocolConflict`.|
   |`spec.listeners[].hostname`|The SNI hostname that selects the listener. Each listener on the port must claim a different hostname.|
   |`spec.listeners[0].tls.mode`|`Terminate` for the HTTPS listener. The gateway decrypts the connection with the `https` Secret and routes the HTTP request.|
   |`spec.listeners[1].tls.mode`|`Passthrough` for the TLS listener. The gateway forwards the encrypted connection without decrypting it.|

5. Create an HTTPRoute for the HTTPS listener and a TLSRoute for the TLS passthrough listener.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-shared-port
     namespace: httpbin
     labels:
       example: httpbin-https
   spec:
     parentRefs:
     - name: https-passthrough
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
       sectionName: https
     hostnames:
     - https.example.com
     rules:
     - backendRefs:
       - name: httpbin
         port: 8000
   ---
   apiVersion: gateway.networking.k8s.io/v1
   kind: TLSRoute
   metadata:
     name: passthrough-nginx
     namespace: httpbin
   spec:
     parentRefs:
     - name: https-passthrough
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
       sectionName: tls-passthrough
     hostnames:
     - passthrough.example.com
     rules:
     - backendRefs:
       - name: passthrough-nginx
         port: 443
   EOF
   ```

   Example output:
   ```console
   httproute.gateway.networking.k8s.io/httpbin-shared-port created
   tlsroute.gateway.networking.k8s.io/passthrough-nginx created
   ```

6. Verify that both listeners are accepted and programmed, and that each has one route attached.
   ```sh
   kubectl get gateway https-passthrough -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{range .status.listeners[*]}{.name}{": attachedRoutes="}{.attachedRoutes}{"\n"}{range .conditions[*]}{"  "}{.type}={.status} ({.reason}){"\n"}{end}{end}'
   ```

   Example output:
   ```console
   https: attachedRoutes=1
     Accepted=True (Accepted)
     Conflicted=False (NoConflicts)
     Programmed=True (Programmed)
     ResolvedRefs=True (ResolvedRefs)
   tls-passthrough: attachedRoutes=1
     Accepted=True (Accepted)
     Conflicted=False (NoConflicts)
     Programmed=True (Programmed)
     ResolvedRefs=True (ResolvedRefs)
   ```

7. Get the address of the Gateway.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} https-passthrough -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward svc/https-passthrough -n {{< reuse "agw-docs/snippets/namespace.md" >}} 9443:443
   ```
   {{% /tab %}}
   {{< /tabs >}}

8. Send a request to the HTTPS hostname. The gateway presents its own `*.example.com` certificate and returns the httpbin response.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -v --cacert example_certs/root.crt --resolve "https.example.com:443:${INGRESS_GW_ADDRESS}" https://https.example.com/status/200
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -v --cacert example_certs/root.crt --connect-to https.example.com:443:localhost:9443 https://https.example.com/status/200
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console
   * ALPN: server accepted h2
   * Server certificate:
   *  subject: CN=*.example.com; O=any domain
   *  subjectAltName: host "https.example.com" matched cert's "*.example.com"
   *  issuer: O=any domain; CN=*
   ...
   < HTTP/2 200
   ```

9. Send a request to the passthrough hostname. The nginx server presents its own `passthrough.example.com` certificate and answers the request, because the gateway did not decrypt the connection.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -v --cacert example_certs/root.crt --resolve "passthrough.example.com:443:${INGRESS_GW_ADDRESS}" https://passthrough.example.com/
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -v --cacert example_certs/root.crt --connect-to passthrough.example.com:443:localhost:9443 https://passthrough.example.com/
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console
   * ALPN: server accepted http/1.1
   * Server certificate:
   *  subject: CN=passthrough.example.com
   *  subjectAltName: host "passthrough.example.com" matched cert's "passthrough.example.com"
   *  issuer: O=any domain; CN=*
   ...
   < HTTP/1.1 200 OK
   < Server: nginx/1.27.5
   ...
   hello from the TLS passthrough backend
   ```
{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

{{< tabs >}}
{{% tab name="Gateway listeners" %}}
```sh {paths="https-listener"}
kubectl delete -A gateways,httproutes,secret -l example=httpbin-https
rm -rf example_certs
```
{{% /tab %}}
{{% tab name="ListenerSet" %}}
```sh
kubectl delete -A gateways,httproutes,listenersets,secret -l example=httpbin-https
rm -rf example_certs
```
{{% /tab %}}
{{< /tabs >}}
{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
If you shared the HTTPS port with a TLS passthrough listener, also delete the TLSRoute and the nginx server.

```sh
kubectl delete tlsroute passthrough-nginx -n httpbin
kubectl delete deployment,service,configmap passthrough-nginx -n httpbin
```
{{< /version >}}





