Originate a one-way TLS connection from the Gateway to a backend. 

{{< callout type="warning" >}}
{{< reuse "agw-docs/versions/warn-experimental.md" >}}
{{< /callout >}}

## About one-way TLS

When you configure a TLS listener on your Gateway, the Gateway typically terminates incoming TLS traffic and forwards the unencrypted traffic to the backend service. However, you might have a service that only accepts TLS connections, or you want to forward traffic to a secured backend service that is external to the cluster.

You can use the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} BackendTLSPolicy](https://gateway-api.sigs.k8s.io/api-types/backendtlspolicy/) to configure TLS origination from the Gateway to a service in the cluster. This policy supports simple, one-way TLS use cases. 

## About this guide

In this guide, you learn how to use the BackendTLSPolicy resource to originate one-way TLS connections for the following services: 
* [**In-cluster service**](#in-cluster-service): An NGINX server that is configured with a self-signed TLS certificate and deployed to the same cluster as the Gateway. You use a BackendTLSPolicy to originate TLS connections to NGINX. 
* [**External service**](#external-service): The `httpbin.org` hostname, which represents an external service that you want to originate a TLS connection to. You use a BackendTLSPolicy resource to originate TLS connections to that hostname. 

## Before you begin

{{< reuse "agw-docs/snippets/prereq-x-channel.md" >}}

## In-cluster service

Deploy an NGINX server in your cluster that is configured for TLS traffic. Then, instruct the gateway proxy to terminate TLS traffic at the gateway and originate a new TLS connection from the gateway proxy to the NGINX server.

### Deploy the sample app

The following example uses an NGINX server with a self-signed TLS certificate.

1. Deploy the NGINX server with a self-signed TLS certificate.

   ```shell
   kubectl apply -f https://raw.githubusercontent.com/solo-io/gloo-mesh-use-cases/refs/heads/main/agentgateway/nginx-tls.yaml
   ```

2. Verify that the NGINX server is running.

   ```shell
   kubectl get pods -l app.kubernetes.io/name=nginx -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```
   NAME    READY   STATUS    RESTARTS   AGE
   nginx   1/1     Running   0          9s
   ```
   
### Originate TLS connections {#create-backend-tls-policy}

Create a BackendTLSPolicy for the NGINX workload. 

1. Create a Kubernetes ConfigMap that has the certificate the Gateway uses to verify the NGINX server. The NGINX deployment uses a self-signed certificate, so use that same certificate (the server cert) as the trust anchor in `ca.crt`. This certificate must match the one in the [nginx-tls.yaml](https://raw.githubusercontent.com/solo-io/gloo-mesh-use-cases/refs/heads/main/agentgateway/nginx-tls.yaml) deployment.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   data:
     ca.crt: |
       -----BEGIN CERTIFICATE-----
       MIIDFTCCAf2gAwIBAgIUG9Mdv3nOQ2i7v68OgjArU4lhBikwDQYJKoZIhvcNAQEL
       BQAwFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjUwNzA3MTA0MDQwWhcNMjYw
       NzA3MTA0MDQwWjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcN
       AQEBBQADggEPADCCAQoCggEBANueqwfAApjTfg+nxIoKVK4sK/YlNICvdoEq1UEL
       StE9wfTv0J27uNIsfpMqCx0Ni9Rjt1hzjunc8HUJDeobMNxGaZmryQofrdJWJ7Uu
       t5jeLW/w0MelPOfFLsDiM5REy4WuPm2X6v1Z1N3N5GR3UNDOtDtsbjS1momvooLO
       9WxPIr2cfmPqr81fyyD2ReZsMC/8lVs0PkA9XBplMzpSU53DWl5/Nyh2d1W5ENK0
       Zw1l5Ze4UGUeohQMa5cD5hmZcBjOeJF8MuSTi3167KSopoqfgHTvC5IsBeWXAyZF
       81ihFYAq+SbhUZeUlsxc1wveuAdBRzafcYkK47gYmbq1K60CAwEAAaNbMFkwFgYD
       VR0RBA8wDYILZXhhbXBsZS5jb20wCwYDVR0PBAQDAgeAMBMGA1UdJQQMMAoGCCsG
       AQUFBwMBMB0GA1UdDgQWBBSoa1Zu2o+pQ6sq2HcOjAglZkp01zANBgkqhkiG9w0B
       AQsFAAOCAQEADZq1EMw/jMl0z2LpPh8cXbP09BnfXhoFbpL4cFrcBNEyig0oPO0j
       YN1e4bfURNduFVnC/FDnZhR3FlAt8a6ozJAwmJp+nQCYFoDQwotSx12y5Bc9IXwd
       BRZaLgHYy2NjGp2UgAya2z23BkUnwOJwJNMCzuGw3pOsmDQY0diR8ZWmEYYEPheW
       6BVkrikzUNXv3tB8LmWzxV9V3eN71fnP5u39IM/UQsOZGRUow/8tvN2/d0W4dHky
       t/kdgLKhf4gU2wXq/WbeqxlDSpjo7q/emNl59v1FHeR3eITSSjESU+dQgRsYaGEn
       SWP+58ApfCcURLpMxUmxkO1ayfecNJbmSQ==
       -----END CERTIFICATE-----
   kind: ConfigMap
   metadata:
     name: ca
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx
   EOF
   ```

2. Create the TLS policy. Note that to use the BackendTLSPolicy, you must have the experimental channel of the Kubernetes Gateway API version 1.4 or later.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: BackendTLSPolicy
   metadata:
     name: tls-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: nginx
     validation:
       hostname: "example.com"
       caCertificateRefs:
       - group: ""
         kind: ConfigMap
         name: ca
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} docs](https://gateway-api.sigs.k8s.io/api-types/backendtlspolicy/).

   | Setting | Description |
   |---------|-------------|
   | `targetRefs` | The service that you want the Gateway to originate a TLS connection to, such as the NGINX server. <br><br>**Agentgateway proxies**: Even if you use a Backend for selector-based destinations, you still need to target the backing Service and the `sectionName` of the port that you want the policy to apply to.  |
   | `validation.hostname` | The hostname that matches the NGINX server certificate. |
   | `validation.caCertificateRefs` | The ConfigMap that has the certificate used to verify the backend. For the NGINX deployment in this guide, the server uses a self-signed certificate, so use that same certificate as the trust anchor. |

3. Create an HTTPRoute that routes traffic to the NGINX server on the `example.com` hostname and HTTPS port 8443. Note that the parent Gateway is the sample `http` Gateway resource that you created [before you began](#before-you-begin).

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1beta1
   kind: HTTPRoute
   metadata:
     name: nginx-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
      app: nginx
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
     - "example.com"
     rules:
     - backendRefs:
       - name: nginx
         port: 8443
   EOF
   ```

4. Send a request to the NGINX server and verify that you get back a 200 HTTP response code.
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/ -H "host: example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi http://localhost:8080/ -H "host: example.com:8080"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   * Host localhost:8080 was resolved.
   * IPv6: ::1
   * IPv4: 127.0.0.1
   *   Trying [::1]:8080...
   * Connected to localhost (::1) port 8080
   > GET / HTTP/1.1
   > Host: example.com:8080
   > User-Agent: curl/8.7.1
   > Accept: */*
   > 
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ```

   The HTTPRoute forwards the request to the NGINX server on port 8443, and the NGINX server accepts only TLS on that port. A 200 response means that the gateway proxy originated a TLS connection to the backend successfully. Without a valid BackendTLSPolicy and CA certificate, requests fail with `invalid peer certificate: UnknownIssuer`.

   
## External service

Set up an {{< reuse "agw-docs/snippets/backend.md" >}} resource that represents your external service. Then, use a BackendTLSPolicy to instruct the gateway proxy to originate a TLS connection from the gateway proxy to the external service. 

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that represents your external service. In this example, you use a static backend that routes traffic to the `httpbin.org` site. Make sure to include the HTTPS port 443 so that traffic is routed to this port. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: httpbin-org
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: httpbin.org
       port: 443
   EOF
   ```
   
2. Create a TLS policy that originates a TLS connection to the {{< reuse "agw-docs/snippets/backend.md" >}} that you created in the previous step. To originate the TLS connection, you use known trusted CA certificates.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: BackendTLSPolicy
   metadata:
     name: httpbin-org
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - name: httpbin-org
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         group: agentgateway.dev
     validation:
       hostname: httpbin.org
       wellKnownCACertificates: System
   EOF
   ```

3. Create an HTTPRoute that rewrites traffic on the `httpbin-external.example` domain to the `httpbin.org` hostname and routes traffic to your Backend.  
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-org
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
     - "httpbin-external.example"
     rules:
       - matches:
         - path:
             type: PathPrefix
             value: /anything
         backendRefs:
         - name: httpbin-org
           kind: AgentgatewayBackend
           group: agentgateway.dev
         filters:
         - type: URLRewrite
           urlRewrite:
             hostname: httpbin.org
   EOF
   ```

4. Send a request to the `httpbin-external.example` domain. Verify that the host is rewritten to `https://httpbin.org/anything` and that you get back a 200 HTTP response code.  
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2">}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/anything -H "host: httpbin-external.example" 
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi http://localhost:8080/anything -H "host: httpbin-external.example" 
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```console {hl_lines=[1,2,20]}
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...
   {
     "args": {}, 
     "data": "", 
     "files": {}, 
     "form": {}, 
     "headers": {
       "Accept": "*/*", 
       "Host": "httpbin.org", 
       "User-Agent": "curl/8.7.1", 
       "X-Amzn-Trace-Id": "Root=1-6881126a-03bfc90450805b9703e66e78", 
       "X-Envoy-Expected-Rq-Timeout-Ms": "15000", 
       "X-Envoy-External-Address": "10.0.X.XXX"
     }, 
     "json": null, 
     "method": "GET", 
     "origin": "10.0.X.XXX, 3.XXX.XXX.XXX", 
     "url": "https://httpbin.org/anything"
   }
   ```


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

### In-cluster service

```sh
kubectl delete -f https://raw.githubusercontent.com/solo-io/gloo-mesh-use-cases/refs/heads/main/agentgateway/nginx-tls.yaml
kubectl delete backendtlspolicy,configmap,httproute -A -l app=nginx
```


### External service

Delete the resources that you created. 

```sh
kubectl delete httproute httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete backendtlspolicy httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
