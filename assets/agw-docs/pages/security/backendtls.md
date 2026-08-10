Originate a one-way TLS connection from the Gateway to a backend. 

> [!WARNING]
> {{< reuse "agw-docs/versions/warn-experimental.md" >}}

## About one-way TLS

When you configure a TLS listener on your Gateway, the Gateway typically terminates incoming TLS traffic and forwards the unencrypted traffic to the backend service. However, you might have a service that only accepts TLS connections, or you want to forward traffic to a secured backend service that is external to the cluster.

You can use the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} BackendTLSPolicy](https://gateway-api.sigs.k8s.io/reference/api-types/policy/backendtlspolicy/) to configure TLS origination from the Gateway to a service in the cluster. This policy supports simple, one-way TLS use cases. 

{{< version include-if="main" >}}
### CA certificate sources {#ca-sources}

In a BackendTLSPolicy, the CA certificate that verifies the backend must come from a Kubernetes ConfigMap. The gateway rejects a `validation.caCertificateRefs` entry that refers to any other kind of resource.

If you keep your CA certificates in Kubernetes Secrets, such as when a Secret is issued by cert-manager or synced from an external secret store, use the {{< reuse "agw-docs/snippets/policy.md" >}} resource instead. The `tls.caCertificateRefs` field in this resource takes an optional `kind` setting that you can set to `ConfigMap` (the default) or `Secret`. Either source must provide the certificate in a `ca.crt` key. For an example, see [CA certificate in a Secret](#secret-ca).

The `tls.caCertificateRefs` field is available in each place that the {{< reuse "agw-docs/snippets/policy.md" >}} and {{< reuse "agw-docs/snippets/backend.md" >}} resources configure backend TLS, such as `spec.backend.tls` in a policy, `spec.policies.tls` in a backend, and the per-target `policies.tls` settings of an MCP or LLM backend.
{{< /version >}}

## About this guide

In this guide, you learn how to originate one-way TLS connections for the following services: 
* [**In-cluster service**](#in-cluster-service): An NGINX server that is configured with a self-signed TLS certificate and deployed to the same cluster as the Gateway. You use a BackendTLSPolicy to originate TLS connections to NGINX. 
* [**External service**](#external-service): The `httpbin.org` hostname, which represents an external service that you want to originate a TLS connection to. You use a BackendTLSPolicy resource to originate TLS connections to that hostname. {{< version include-if="main" >}}
* [**CA certificate in a Secret**](#secret-ca): The same NGINX server, but with the CA certificate stored in a Kubernetes Secret instead of a ConfigMap. You use an {{< reuse "agw-docs/snippets/policy.md" >}} to originate TLS connections to NGINX.{{< /version >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-x-channel.md" >}}

## In-cluster service

Deploy an NGINX server in your cluster that is configured for TLS traffic. Then, instruct the gateway proxy to terminate TLS traffic at the gateway and originate a new TLS connection from the gateway proxy to the NGINX server.

### Create sample certificates

Create a CA and a server certificate for the `example.com` hostname. If you already have your own certificates such as from a CA provider, update the steps accordingly.

{{< reuse "agw-docs/snippets/create-ca-server-certs.md" >}}

### Deploy the sample app


Deploy an NGINX server that serves HTTPS traffic. The NGINX server presents the server certificate, and the gateway proxy later uses the CA certificate to verify it.

1. Store the server certificate and key in a Kubernetes secret that the NGINX server mounts.

   ```sh {paths="backendtls-secret-ca"}
   kubectl create secret tls nginx-server-cert \
     --cert=server-cert.pem \
     --key=server-key.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Deploy the NGINX server and a Service that exposes it on HTTPS port 8443.

   ```yaml {paths="backendtls-secret-ca"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: nginx-conf
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx
   data:
     nginx.conf: |
       events {}
       http {
         server {
             listen              443 ssl;
             server_name         example.com;
             ssl_certificate     /etc/nginx/certs/tls.crt;
             ssl_certificate_key /etc/nginx/certs/tls.key;
             location / {
               return 200 "hello from nginx\n";
             }
         }
       }
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: nginx
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx
   spec:
     replicas: 1
     selector:
       matchLabels:
         app.kubernetes.io/name: nginx
     template:
       metadata:
         labels:
           app.kubernetes.io/name: nginx
       spec:
         containers:
         - name: nginx
           image: nginx:stable
           ports:
           - containerPort: 443
             name: https-web-svc
           volumeMounts:
           - name: nginx-conf
             mountPath: /etc/nginx/nginx.conf
             subPath: nginx.conf
           - name: server-cert
             mountPath: /etc/nginx/certs
             readOnly: true
         volumes:
         - name: nginx-conf
           configMap:
             name: nginx-conf
         - name: server-cert
           secret:
             secretName: nginx-server-cert
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: nginx
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx
   spec:
     selector:
       app.kubernetes.io/name: nginx
     ports:
     - protocol: TCP
       port: 8443
       targetPort: https-web-svc
       name: https
   EOF
   ```

{{< doc-test paths="backendtls-secret-ca" >}}
# WHAT THIS TEST VALIDATES:
#   * The certificate generation shared with the mTLS guide - the openssl CA and
#     server-cert commands actually run, so the guide cannot rot the way the old
#     hardcoded PEM did (it expired 2026-07-07 and broke this page silently).
#   * The NGINX sample app it deploys: the nginx-server-cert Secret, nginx-conf
#     ConfigMap, Deployment, and Service reach an available state.
#   * The "CA certificate in a Secret" section end to end - the nginx-route
#     HTTPRoute, the nginx-ca Secret, and the nginx-backend-tls
#     AgentgatewayPolicy - and asserts a 200 through the gateway, which only
#     succeeds if the gateway resolved the CA from the Secret and verified the
#     backend certificate against it.
#   * That `sectionName: "8443"` on a Service targetRef is accepted (the API
#     rejects a port NAME here, so this guards the documented value).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The "In-cluster service" BackendTLSPolicy section - display-only for this
#     scenario; it has no test path of its own, so its `ca` ConfigMap and
#     BackendTLSPolicy blocks never run.
#   * The "External service" section - external dependency (httpbin.org egress).
#   * The `kind: ConfigMap` / omitted-kind variants of caCertificateRefs -
#     requires config the page omits; the page documents only the Secret variant.
#   * The port-forward tab of the verification step - the framework forbids
#     `kubectl port-forward`, so the assertion uses ${INGRESS_GW_ADDRESS}.
YAMLTest -f - <<'EOF'
- name: wait for the NGINX TLS sample app to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: nginx
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

6. Verify that the NGINX server is running.

   ```shell
   kubectl get pods -l app.kubernetes.io/name=nginx -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```
   NAME                     READY   STATUS    RESTARTS   AGE
   nginx-7c8f9d5b4c-x2vlq   1/1     Running   0          9s
   ```
   
### Originate TLS connections {#create-backend-tls-policy}

Create a BackendTLSPolicy for the NGINX workload. 

1. Create a Kubernetes ConfigMap that has the CA certificate the Gateway uses to verify the NGINX server. The CA certificate must be in the `ca.crt` key.

   ```sh
   kubectl create configmap ca \
     --from-file=ca.crt=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
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

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} docs](https://gateway-api.sigs.k8s.io/reference/api-types/policy/backendtlspolicy/).

   | Setting | Description |
   |---------|-------------|
   | `targetRefs` | The service that you want the Gateway to originate a TLS connection to, such as the NGINX server. <br><br>**Agentgateway proxies**: Even if you use a Backend for selector-based destinations, you still need to target the backing Service and the `sectionName` of the port that you want the policy to apply to.  |
   | `validation.hostname` | The hostname that matches the NGINX server certificate. The gateway verifies this hostname against the Subject Alternative Names (SANs) or Common Name (CN) in the server certificate. |
   | `validation.caCertificateRefs` | The ConfigMap that has the CA certificate used to verify the backend, in a `ca.crt` key. For the NGINX deployment in this guide, use the CA that signed the NGINX server certificate. |

3. Create an HTTPRoute that routes traffic to the NGINX server on the `example.com` hostname and HTTPS port 8443. Note that the parent Gateway is the sample `http` Gateway resource that you created [before you began](#before-you-begin).

   ```yaml {paths="backendtls-secret-ca"}
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
   
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/ -H "host: example.com:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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
   
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/anything -H "host: httpbin-external.example" 
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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

{{< version include-if="main" >}}

## CA certificate in a Secret {#secret-ca}

A BackendTLSPolicy reads the CA certificate only from a ConfigMap. To verify a backend by using a CA certificate that is stored in a Kubernetes Secret, use the {{< reuse "agw-docs/snippets/policy.md" >}} resource instead, and set `kind: Secret` in the `caCertificateRefs` field.

This section reuses the NGINX server and the `nginx-route` HTTPRoute that you created in the [In-cluster service](#in-cluster-service) section.

1. Delete the BackendTLSPolicy that you created earlier so that the {{< reuse "agw-docs/snippets/policy.md" >}} is the only source of backend TLS settings for the NGINX server.

   ```sh {paths="backendtls-secret-ca"}
   kubectl delete backendtlspolicy tls-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
   ```

2. Create a Kubernetes Secret that has the same CA certificate that you stored in the ConfigMap earlier. The certificate must be in the `ca.crt` key, which is the same key that a ConfigMap source uses.

   ```sh {paths="backendtls-secret-ca"}
   kubectl create secret generic nginx-ca \
     --from-file=ca.crt=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that originates TLS to the NGINX server and verifies the server certificate by using the Secret.

   ```yaml {paths="backendtls-secret-ca"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: nginx-backend-tls
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: nginx
       sectionName: "8443"
     backend:
       tls:
         caCertificateRefs:
         - name: nginx-ca
           kind: Secret
         sni: example.com
         verifySubjectAltNames:
         - example.com
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#backendtls" >}}).

   | Setting | Description |
   |---------|-------------|
   | `targetRefs` | The Service that you want the Gateway to originate a TLS connection to. Use `sectionName` to select the port that the policy applies to. For a Service, `sectionName` must be the numeric port, such as `"8443"`, and not the name of the port. |
   | `backend.tls.caCertificateRefs` | The CA certificate source that has the certificate used to verify the backend, in a `ca.crt` key. Set `kind` to `Secret` to read the certificate from a Kubernetes Secret, or omit `kind` to read it from a ConfigMap. The gateway does not fall back between sources, so if a Secret and a ConfigMap have the same name, only the source that `kind` selects is used. |
   | `backend.tls.sni` | The Server Name Indication (SNI) value to send in the TLS handshake. If unset, the SNI is derived from the destination hostname, which does not match the NGINX server certificate in this example. |
   | `backend.tls.verifySubjectAltNames` | The Subject Alternative Names (SANs) to verify in the server certificate. If unset, the destination hostname is used, which does not match the NGINX server certificate in this example. |

4. Send a request to the NGINX server and verify that you get back a 200 HTTP response code.

   * **Cloud Provider LoadBalancer**
     ```sh
     curl -vi http://$INGRESS_GW_ADDRESS:80/ -H "host: example.com:80"
     ```
   * **Port-forward for local testing**
     ```sh
     curl -vi http://localhost:8080/ -H "host: example.com:8080"
     ```
  
   Example output:

   ```
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ```

{{< doc-test paths="backendtls-secret-ca" >}}
# Secret CA scenario: wait for the policy to attach before sending traffic.
YAMLTest -f - <<'EOF'
- name: nginx-backend-tls policy is accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: nginx-backend-tls
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="backendtls-secret-ca" >}}
# Secret CA scenario: example.com is a new hostname for the proxy, so warm up
# the data plane before asserting (Phase 1 of the two-phase proxy behavior).
for i in $(seq 1 60); do
  curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}:80/" -H "host: example.com" && break
  sleep 2
done
{{< /doc-test >}}

{{< doc-test paths="backendtls-secret-ca" >}}
YAMLTest -f - <<'EOF'
- name: gateway originates TLS to NGINX using the CA from the Secret
  retries: 1
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80"
    path: /
    method: GET
    headers:
      host: "example.com"
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

### In-cluster service

```sh {paths="backendtls-secret-ca"}
kubectl delete deployment,service,backendtlspolicy,configmap,httproute -A -l app=nginx
kubectl delete secret nginx-server-cert -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete configmap ca -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```

Remove the certificates that you created.

```sh {paths="backendtls-secret-ca"}
cd .. && rm -rf example_certs
```

### External service

Delete the resources that you created. 

```sh
kubectl delete httproute httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete backendtlspolicy httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< version include-if="main" >}}
### CA certificate in a Secret

```sh {paths="backendtls-secret-ca"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} nginx-backend-tls -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete secret nginx-ca -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
{{< /version >}}
