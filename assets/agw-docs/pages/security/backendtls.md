Originate a one-way TLS connection from the Gateway to a backend. 

> [!NOTE]
> BackendTLSPolicy is generally available in the standard channel of the Kubernetes Gateway API since version 1.4.0. You do not need the experimental CRDs to use it. For details, see the [upstream BackendTLSPolicy documentation](https://gateway-api.sigs.k8s.io/reference/api-types/policy/backendtlspolicy/).

## About one-way TLS

When you configure a TLS listener on your Gateway, the Gateway typically terminates incoming TLS traffic and forwards the unencrypted traffic to the backend service. However, you might have a service that only accepts TLS connections, or you want to forward traffic to a secured backend service that is external to the cluster.

You can use the [{{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} BackendTLSPolicy](https://gateway-api.sigs.k8s.io/reference/api-types/policy/backendtlspolicy/) to configure TLS origination from the Gateway to a service in the cluster. This policy supports simple, one-way TLS use cases. 

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
### CA certificate sources {#ca-sources}

{{< version include-if="1.6.x" >}}
In a BackendTLSPolicy, the CA certificate that verifies the backend must come from a Kubernetes ConfigMap. The gateway rejects a `validation.caCertificateRefs` entry that refers to any other kind of resource.
{{< /version >}}
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}
In a BackendTLSPolicy, the CA certificate that verifies the backend comes from a Kubernetes ConfigMap, or from a ClusterTrustBundle if your cluster serves the ClusterTrustBundle API. ClusterTrustBundle support is experimental. The gateway rejects a `validation.caCertificateRefs` entry that refers to any other kind of resource.

A ClusterTrustBundle is a cluster-scoped resource in the `certificates.k8s.io` API group that holds one or more PEM-encoded CA certificates in its `spec.trustBundle` field. To use one, set the `group` and `kind` fields of the reference, as in the following example. For the full steps, see [CA certificate in a ClusterTrustBundle](#clustertrustbundle-ca).

```yaml
validation:
  hostname: "example.com"
  caCertificateRefs:
  - group: certificates.k8s.io
    kind: ClusterTrustBundle
    name: example-ca
```
{{< /version >}}

If you keep your CA certificates in Kubernetes Secrets, such as when a Secret is issued by cert-manager or synced from an external secret store, use the {{< reuse "agw-docs/snippets/policy.md" >}} resource instead. The `tls.caCertificateRefs` field in this resource takes an optional `kind` setting that you can set to `ConfigMap` (the default) or `Secret`. Either source provides the certificate in a `ca.crt` key by default. To read the certificate from another key, set the optional `key` setting to that key name. This setting helps when a trust-manager bundle or an external secret store writes the certificate under a descriptive name, or when one object holds several bundles. For an example, see [CA certificate in a Secret](#secret-ca).

> [!NOTE]
> The `key` setting applies only to the `caCertificateRefs` field in the {{< reuse "agw-docs/snippets/policy.md" >}} and {{< reuse "agw-docs/snippets/backend.md" >}} resources. A BackendTLSPolicy and a Gateway listener's `frontendValidation` field use the {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}} reference type, which has no key setting. A ConfigMap or Secret that those references name must hold the certificate in the `ca.crt` key.

The `tls.caCertificateRefs` field is available in each place that the {{< reuse "agw-docs/snippets/policy.md" >}} and {{< reuse "agw-docs/snippets/backend.md" >}} resources configure backend TLS, such as `spec.backend.tls` in a policy, `spec.policies.tls` in a backend, and the per-target `policies.tls` settings of an MCP or LLM backend.
{{< /version >}}

## About this guide

In this guide, you learn how to originate one-way TLS connections for the following services: 
* [**In-cluster service**](#in-cluster-service): An NGINX server that is configured with a self-signed TLS certificate and deployed to the same cluster as the Gateway. You use a BackendTLSPolicy to originate TLS connections to NGINX. 
* [**External service**](#external-service): The `httpbin.org` hostname, which represents an external service that you want to originate a TLS connection to. You use a BackendTLSPolicy resource to originate TLS connections to that hostname. {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}
* [**CA certificate in a ClusterTrustBundle**](#clustertrustbundle-ca): The same NGINX server, but with the CA certificate stored in a ClusterTrustBundle instead of a ConfigMap. You use a BackendTLSPolicy to originate TLS connections to NGINX.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
* [**CA certificate in a Secret**](#secret-ca): The same NGINX server, but with the CA certificate stored in a Kubernetes Secret instead of a ConfigMap. You use an {{< reuse "agw-docs/snippets/policy.md" >}} to originate TLS connections to NGINX.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}}
* [**Client certificate from files**](#client-cert-files): A second NGINX server that requires a client certificate. You mount the client certificate and key into the gateway proxy pod, and use an {{< reuse "agw-docs/snippets/policy.md" >}} to originate mutual TLS connections to NGINX with files that rotate without a restart.{{< /version >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## In-cluster service

Deploy an NGINX server in your cluster that is configured for TLS traffic. Then, instruct the gateway proxy to terminate TLS traffic at the gateway and originate a new TLS connection from the gateway proxy to the NGINX server.

### Create sample certificates

Create a CA and a server certificate for the `example.com` hostname. If you already have your own certificates such as from a CA provider, update the steps accordingly.

{{< reuse "agw-docs/snippets/create-ca-server-certs.md" >}}

### Deploy the sample app


Deploy an NGINX server that serves HTTPS traffic. The NGINX server presents the server certificate, and the gateway proxy later uses the CA certificate to verify it.

1. Store the server certificate and key in a Kubernetes secret that the NGINX server mounts.

   ```sh
   kubectl create secret tls nginx-server-cert \
     --cert=server-cert.pem \
     --key=server-key.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Deploy the NGINX server and a Service that exposes it on HTTPS port 8443.

   ```yaml
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

2. Create the TLS policy. The `v1` BackendTLSPolicy requires Kubernetes Gateway API version 1.4 or later. The standard channel is sufficient.

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

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
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

   {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
   For other errors that invalid TLS settings cause, see [Invalid backend TLS settings](#invalid-tls-settings).
   {{< /version >}}

   
## External service

Set up an {{< reuse "agw-docs/snippets/backend.md" >}} resource that represents your external service. Then, use a BackendTLSPolicy to instruct the gateway proxy to originate a TLS connection from the gateway proxy to the external service. 

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} resource that represents your external service. In this example, you use a static backend that routes traffic to the `httpbin.org` site. Make sure to include the HTTPS port 443 so that traffic is routed to this port. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
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

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}

## CA certificate in a ClusterTrustBundle {#clustertrustbundle-ca}

> [!WARNING]
> {{< reuse "agw-docs/snippets/feature-experimental.md">}}

A BackendTLSPolicy can read the CA certificate from a ClusterTrustBundle instead of a ConfigMap. A ClusterTrustBundle is cluster-scoped, so you can keep one set of CA certificates for BackendTLSPolicies in every namespace.

Agentgateway uses the `certificates.k8s.io/v1` version of the ClusterTrustBundle API, which Kubernetes serves by default in version 1.37 and later. The `v1beta1` version that earlier Kubernetes versions can serve is not supported. The controller checks for the API when it starts. If your cluster starts to serve the API after you install {{< reuse "agw-docs/snippets/agentgateway.md" >}}, restart the controller.

This section reuses the NGINX server, the `tls-policy` BackendTLSPolicy, and the `nginx-route` HTTPRoute that you created in the [In-cluster service](#in-cluster-service) section.

1. Verify that the controller found the ClusterTrustBundle API. The GatewayClass lists the `ClusterTrustBundle` feature only if the cluster serves the API.

   ```sh
   kubectl get gatewayclass {{< reuse "agw-docs/snippets/gatewayclass.md" >}} \
     -o jsonpath='{.status.supportedFeatures[*].name}' | tr ' ' '\n' | grep ClusterTrustBundle
   ```

   Example output:

   ```
   ClusterTrustBundle
   ```

   If the command returns no output, use a ConfigMap as the CA source instead.

2. Create a ClusterTrustBundle that has the CA certificate that signed the NGINX server certificate. Run the command from the directory that has the `ca-cert.pem` file.

   ```sh
   kubectl apply -f- <<EOF
   apiVersion: certificates.k8s.io/v1
   kind: ClusterTrustBundle
   metadata:
     name: example-ca
   spec:
     trustBundle: |
   $(sed 's/^/    /' ca-cert.pem)
   EOF
   ```

   Example output:

   ```
   clustertrustbundle.certificates.k8s.io/example-ca created
   ```

3. Update the BackendTLSPolicy to read the CA certificate from the ClusterTrustBundle.

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
       - group: certificates.k8s.io
         kind: ClusterTrustBundle
         name: example-ca
   EOF
   ```

   Example output:

   ```
   backendtlspolicy.gateway.networking.k8s.io/tls-policy configured
   ```

4. Check the conditions of the BackendTLSPolicy.

   ```sh
   kubectl get backendtlspolicy tls-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{range .status.ancestors[0].conditions[*]}{.type}={.status} {.reason}{"\n"}{end}'
   ```

   Example output:

   ```
   Accepted=True Accepted
   ResolvedRefs=True ResolvedRefs
   ```

   If the cluster does not serve the ClusterTrustBundle API, the `ResolvedRefs` condition is `False` with the `InvalidKind` reason and the message `the cluster does not serve the ClusterTrustBundle API`.

5. Send a request to the NGINX server and verify that you get back a 200 HTTP response code.

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

   When you update the certificates in the ClusterTrustBundle, the gateway uses the new certificates without a restart.

You can also use a ClusterTrustBundle to validate client certificates on a Gateway listener. For more information, see [Mutual TLS listeners]({{< link-hextra path="/documentation/setup/listeners/mtls/#ca-sources" >}}).

{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}

## CA certificate in a Secret {#secret-ca}

A BackendTLSPolicy cannot read the CA certificate from a Secret. To verify a backend by using a CA certificate that is stored in a Kubernetes Secret, use the {{< reuse "agw-docs/snippets/policy.md" >}} resource instead, and set `kind: Secret` in the `caCertificateRefs` field.

This section reuses the NGINX server and the `nginx-route` HTTPRoute that you created in the [In-cluster service](#in-cluster-service) section.

1. Delete the BackendTLSPolicy that you created earlier so that the {{< reuse "agw-docs/snippets/policy.md" >}} is the only source of backend TLS settings for the NGINX server.

   ```sh
   kubectl delete backendtlspolicy tls-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
   ```

2. Create a Kubernetes Secret that has the same CA certificate that you stored in the ConfigMap earlier. This example uses the `ca.crt` key, which is the default key for a Secret and a ConfigMap alike. To store the certificate under another key, such as `corporate-roots.pem`, name that key in the policy in the next step.

   ```sh
   kubectl create secret generic nginx-ca \
     --from-file=ca.crt=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that originates TLS to the NGINX server and verifies the server certificate by using the Secret.

   ```yaml
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
   | `backend.tls.caCertificateRefs` | The CA certificate source that has the certificate used to verify the backend. Set `kind` to `Secret` to read the certificate from a Kubernetes Secret, or omit `kind` to read it from a ConfigMap. The gateway does not fall back between sources, so if a Secret and a ConfigMap have the same name, only the source that the `kind` field selects is used. The certificate is read from the `ca.crt` key unless you set `key` to another key name. |
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

### Read the certificate from another key {#ca-key}

A CA source does not have to store the certificate in the `ca.crt` key. Set the `key` field to read the bundle from another key in the same Secret or ConfigMap. This setting helps when a trust-manager bundle or an external secret store writes the certificate under a descriptive name, or when one object holds several bundles.

1. Store the same CA certificate in a Secret under a different key.

   ```sh
   kubectl create secret generic nginx-ca-custom-key \
     --from-file=corporate-roots.pem=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Update the {{< reuse "agw-docs/snippets/policy.md" >}} to name that key.

   ```yaml
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
         - name: nginx-ca-custom-key
           kind: Secret
           key: corporate-roots.pem
         sni: example.com
         verifySubjectAltNames:
         - example.com
   EOF
   ```

3. Send another request to the NGINX server. You still get back a 200 HTTP response code, because the gateway now reads the CA certificate from the `corporate-roots.pem` key.

   * **Cloud Provider LoadBalancer**
     ```sh
     curl -vi http://$INGRESS_GW_ADDRESS:80/ -H "host: example.com:80"
     ```
   * **Port-forward for local testing**
     ```sh
     curl -vi http://localhost:8080/ -H "host: example.com:8080"
     ```

   If the key does not exist in the source, the request fails with a 503 HTTP response code, and the policy reports the missing key in its status.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} nginx-backend-tls -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.status.ancestors[0].conditions}' | jq .
   ```

   Example output:

   ```
   "message": "error extracting CA cert from Secret agentgateway-system/nginx-ca-custom-key: missing key \"corporate-roots.pem\"",
   "reason": "PartiallyValid",
   ```

{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}}

## Client certificate from files {#client-cert-files}

To originate mutual TLS (mTLS) to a backend, the gateway proxy needs a client certificate. Usually, you store the certificate in a Kubernetes Secret and reference it in the `mtlsCertificateRef` field of an {{< reuse "agw-docs/snippets/policy.md" >}}. Instead, you can point `mtlsCertificateRef` at files in the proxy pod. Use files when another component delivers and renews the certificate on disk, such as in the following cases.

* A Container Storage Interface (CSI) driver mounts short-lived certificates into the pod.
* A sidecar or helper, such as one that fetches SPIFFE identities, writes the certificate and key to a shared volume.

The controller does not read the files. The controller passes the paths to the proxy, and the proxy reads the files and watches them. When a file changes, the proxy reloads the client certificate without a policy update and without a restart.

To use files, you mount the files into the proxy pod with an overlay in an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, and then set `kind: File` in the `mtlsCertificateRef` field.

This section reuses the `example_certs` directory, the `nginx-server-cert` Secret, and the `agentgateway-proxy` Gateway from the [In-cluster service](#in-cluster-service) section. The section deploys a second NGINX server that rejects connections without a valid client certificate.

1. From the `example_certs` directory, create a client certificate that the CA signs.

   ```sh
   # Create client private key
   openssl genrsa -out client-key.pem 2048

   # Create client certificate signing request
   openssl req -new -key client-key.pem -out client.csr \
     -subj "/CN=agentgateway-client/O=Test Org"

   # Create client certificate signed by CA (valid for 1 year)
   openssl x509 -req -days 365 -in client.csr -CA ca-cert.pem -CAkey ca-key.pem \
     -CAcreateserial -out client-cert.pem \
     -extensions v3_req -extfile <(echo "[v3_req]"; \
       echo "basicConstraints=CA:FALSE"; \
       echo "keyUsage=digitalSignature,keyEncipherment"; \
       echo "extendedKeyUsage=clientAuth")
   ```

2. Store the CA certificate in a Secret. NGINX uses the CA certificate to verify client certificates, and the gateway proxy uses it to verify the server certificate.

   ```sh
   kubectl create secret generic nginx-mtls-ca \
     --from-file=ca.crt=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Deploy an NGINX server that requires a client certificate. The server presents the same server certificate as before. In its response, the server echoes the subject of the client certificate so that you can see which certificate the gateway proxy presented.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: nginx-mtls-conf
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx-mtls
   data:
     nginx.conf: |
       events {}
       http {
         server {
             listen                 443 ssl;
             server_name            example.com;
             ssl_certificate        /etc/nginx/certs/tls.crt;
             ssl_certificate_key    /etc/nginx/certs/tls.key;
             ssl_client_certificate /etc/nginx/client-ca/ca.crt;
             ssl_verify_client      on;
             location / {
               return 200 "hello from nginx, client certificate: \$ssl_client_s_dn\n";
             }
         }
       }
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: nginx-mtls
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx-mtls
   spec:
     replicas: 1
     selector:
       matchLabels:
         app.kubernetes.io/name: nginx-mtls
     template:
       metadata:
         labels:
           app.kubernetes.io/name: nginx-mtls
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
           - name: client-ca
             mountPath: /etc/nginx/client-ca
             readOnly: true
         volumes:
         - name: nginx-conf
           configMap:
             name: nginx-mtls-conf
         - name: server-cert
           secret:
             secretName: nginx-server-cert
         - name: client-ca
           secret:
             secretName: nginx-mtls-ca
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: nginx-mtls
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx-mtls
   spec:
     selector:
       app.kubernetes.io/name: nginx-mtls
     ports:
     - protocol: TCP
       port: 8443
       targetPort: https-web-svc
       name: https
   ---
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: nginx-mtls-route
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx-mtls
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
     - "mtls.example.com"
     rules:
     - backendRefs:
       - name: nginx-mtls
         port: 8443
   EOF
   ```

4. Wait for the NGINX server to start.

   ```sh
   kubectl rollout status deployment/nginx-mtls -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```
   deployment "nginx-mtls" successfully rolled out
   ```

5. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that originates TLS to the NGINX server and verifies the server certificate, but does not send a client certificate yet.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: nginx-mtls-tls
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: nginx-mtls
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: nginx-mtls
       sectionName: "8443"
     backend:
       tls:
         caCertificateRefs:
         - name: nginx-mtls-ca
           kind: Secret
         sni: example.com
         verifySubjectAltNames:
         - example.com
   EOF
   ```

6. Send a request to the NGINX server. The request fails because the gateway proxy does not present a client certificate.

   * **Cloud Provider LoadBalancer**
     ```sh
     curl -i http://$INGRESS_GW_ADDRESS:80/ -H "host: mtls.example.com:80"
     ```
   * **Port-forward for local testing**
     ```sh
     curl -i http://localhost:8080/ -H "host: mtls.example.com:8080"
     ```

   Example output:

   ```
   HTTP/1.1 400 Bad Request
   Server: nginx/1.30.8
   Content-Type: text/html
   ...
   <html>
   <head><title>400 No required SSL certificate was sent</title></head>
   ```

7. Store the client certificate, the client key, and the CA certificate in a Secret. The next step mounts this Secret into the proxy pod. The Secret is a stand-in for the volume that your CSI driver or helper provides. The proxy sees only the files, so the source of the volume does not matter.

   ```sh
   kubectl create secret generic backend-client-cert \
     --from-file=tls.crt=client-cert.pem \
     --from-file=tls.key=client-key.pem \
     --from-file=ca.crt=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

8. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that mounts the files into the `agentgateway` container of the proxy pod. For more information about overlays, see [Overlays]({{< link-hextra path="/documentation/setup/customize/configs/#overlays" >}}).

   ```yaml
   kubectl apply --server-side -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: backend-mtls-files
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     deployment:
       spec:
         template:
           spec:
             volumes:
             - name: backend-mtls
               secret:
                 secretName: backend-client-cert
             containers:
             - name: agentgateway
               volumeMounts:
               - name: backend-mtls
                 mountPath: /etc/backend-mtls
                 readOnly: true
   EOF
   ```

9. Attach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to the Gateway. This command replaces any `parametersRef` that the Gateway already has, so merge the settings into one resource if you use one already. The proxy pod restarts to pick up the mount.

   ```sh
   kubectl patch gateway agentgateway-proxy \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --type merge \
     -p '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"backend-mtls-files"}}}}'
   kubectl rollout status deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```
   gateway.gateway.networking.k8s.io/agentgateway-proxy patched
   deployment "agentgateway-proxy" successfully rolled out
   ```

   If you use a port-forward, stop it and start it again, because it is bound to the pod that restarted.

10. Verify that the proxy container mounts the files. The proxy image has no shell, so you cannot list the files with `kubectl exec`.

    ```sh
    kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
      -o jsonpath='{.spec.template.spec.containers[0].volumeMounts[?(@.name=="backend-mtls")]}'
    ```

    Example output:

    ```
    {"mountPath":"/etc/backend-mtls","name":"backend-mtls","readOnly":true}
    ```

11. Update the {{< reuse "agw-docs/snippets/policy.md" >}} to read the client certificate from the mounted files. With `kind: File`, set the `root` file in place of the `caCertificateRefs` field.

    ```yaml
    kubectl apply -f- <<EOF
    apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
    kind: {{< reuse "agw-docs/snippets/policy.md" >}}
    metadata:
      name: nginx-mtls-tls
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
      labels:
        app: nginx-mtls
    spec:
      targetRefs:
      - group: ""
        kind: Service
        name: nginx-mtls
        sectionName: "8443"
      backend:
        tls:
          sni: example.com
          verifySubjectAltNames:
          - example.com
          mtlsCertificateRef:
          - kind: File
            file:
              cert: /etc/backend-mtls/tls.crt
              key: /etc/backend-mtls/tls.key
              root: /etc/backend-mtls/ca.crt
    EOF
    ```

    {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#backendtls" >}}).

    | Setting | Description |
    |---------|-------------|
    | `backend.tls.mtlsCertificateRef[0].kind` | Set to `File` to read the client certificate from files on the proxy pod. For any other kind, set `name` and omit `file`. |
    | `backend.tls.mtlsCertificateRef[0].file.cert` | The path to the client certificate file in the proxy container. Required. |
    | `backend.tls.mtlsCertificateRef[0].file.key` | The path to the private key file of the client certificate. Required. |
    | `backend.tls.mtlsCertificateRef[0].file.root` | The path to the CA bundle that verifies the backend server certificate. Optional. If unset, the proxy uses the system CA certificates. Do not set `caCertificateRefs` together with a `File` reference, because the API server rejects the combination. |

12. Send another request to the NGINX server. This time, the request succeeds, and the response shows the subject of the client certificate that the gateway proxy presented.

    * **Cloud Provider LoadBalancer**
      ```sh
      curl -i http://$INGRESS_GW_ADDRESS:80/ -H "host: mtls.example.com:80"
      ```
    * **Port-forward for local testing**
      ```sh
      curl -i http://localhost:8080/ -H "host: mtls.example.com:8080"
      ```

    Example output:

    ```
    HTTP/1.1 200 OK
    Server: nginx/1.30.8
    Content-Type: text/plain
    ...
    hello from nginx, client certificate: O=Test Org,CN=agentgateway-client
    ```

### Rotate the client certificate {#client-cert-rotation}

Replace the files to rotate the certificate. You do not need to update the policy or restart the proxy.

1. Create a new client certificate with a different subject.

   ```sh
   openssl genrsa -out client2-key.pem 2048
   openssl req -new -key client2-key.pem -out client2.csr \
     -subj "/CN=agentgateway-client-rotated/O=Test Org"
   openssl x509 -req -days 365 -in client2.csr -CA ca-cert.pem -CAkey ca-key.pem \
     -CAcreateserial -out client2-cert.pem \
     -extensions v3_req -extfile <(echo "[v3_req]"; \
       echo "basicConstraints=CA:FALSE"; \
       echo "keyUsage=digitalSignature,keyEncipherment"; \
       echo "extendedKeyUsage=clientAuth")
   ```

2. Update the Secret that backs the mounted files.

   ```sh
   kubectl create secret generic backend-client-cert \
     --from-file=tls.crt=client2-cert.pem \
     --from-file=tls.key=client2-key.pem \
     --from-file=ca.crt=ca-cert.pem \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --dry-run=client -o yaml | kubectl replace -f -
   ```

3. Check the proxy logs for the reload message. The kubelet refreshes the files in a mounted Secret on its own schedule, so the message can take a minute or more to appear. The proxy reloads the certificate as soon as the files change.

   ```sh
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep "backend TLS"
   ```

   Example output:

   ```
   ... info http::backendtls reloaded backend TLS config after cert/key/root file change
   ```

4. Send another request. The response now shows the subject of the rotated certificate.

   * **Cloud Provider LoadBalancer**
     ```sh
     curl -i http://$INGRESS_GW_ADDRESS:80/ -H "host: mtls.example.com:80"
     ```
   * **Port-forward for local testing**
     ```sh
     curl -i http://localhost:8080/ -H "host: mtls.example.com:8080"
     ```

   Example output:

   ```
   hello from nginx, client certificate: O=Test Org,CN=agentgateway-client-rotated
   ```

If the new files are not valid, such as when the certificate is not PEM or does not match the key, the proxy logs a warning and keeps using the previous certificate. Requests continue to succeed until you fix the files.

```
... warn http::backendtls failed to reload backend TLS cert/key/root files, keeping previous config: no certificate
```

### Restrict the files that the proxy can read {#file-access}

By default, the proxy can read any regular file for a `File` reference, except files under `/dev`, `/proc`, and `/sys`. You do not need to change this setting to use `kind: File`. To limit the files further, set `config.fileAccess` in the `rawConfig` field of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The proxy restarts to pick up the setting.

```sh
kubectl patch {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} backend-mtls-files \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type merge \
  -p '{"spec":{"rawConfig":{"config":{"fileAccess":{"allow":["/etc/backend-mtls"]}}}}}'
```

| Setting | Description |
|---------|-------------|
| `config.fileAccess.allow` | Absolute path prefixes that the proxy can read. If the list is empty, the proxy can read any path that the deny rules do not block. |
| `config.fileAccess.deny` | Absolute path prefixes that the proxy cannot read, in addition to `/dev`, `/proc`, and `/sys`. |

The longest matching prefix wins, and if two prefixes are the same length, `deny` wins. The proxy checks both the path in the policy and the file that the path resolves to, so a symbolic link cannot bypass the rules. If a `File` reference points outside the allowed paths, requests to the backend fail with a 503 HTTP response code. For more information, see [Invalid backend TLS settings](#invalid-tls-settings).

{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}

## Invalid backend TLS settings {#invalid-tls-settings}

When backend TLS settings are invalid, the gateway proxy does not fall back to sending plaintext traffic to the backend. Instead, requests to the backend fail with a 503 HTTP response code. The errors that you see depend on whether the controller or the gateway proxy finds the invalid setting.

### Settings that the proxy marks as invalid {#proxy-invalid-settings}

The controller passes some backend TLS settings to the gateway proxy without fully checking them. If the proxy cannot build a TLS configuration from these settings, it marks the entire backend TLS policy as invalid and fails every request to that backend. This rule applies to the `spec.backend.tls` section of an {{< reuse "agw-docs/snippets/policy.md" >}} and to the `spec.policies.tls` section of an {{< reuse "agw-docs/snippets/backend.md" >}}. The proxy marks the policy as invalid in the following cases:

* The Secret that the `mtlsCertificateRef` setting refers to has a `tls.crt`, `tls.key`, or `ca.crt` value that is not valid PEM. If a `ca.crt` PEM block decodes but does not hold a valid certificate, the proxy skips that certificate instead of marking the policy as invalid.
* An `mtlsCertificateRef` entry of kind `File` points to a file that does not exist, cannot be read, is not a regular file, does not contain valid PEM, or is blocked by `config.fileAccess`. The controller does not read the files, so the policy status still reports `Accepted`. Check the proxy logs for the cause.
* The `certificateSource` setting is `SPIFFE` and the `keyExchangeGroups` setting is also set. A SPIFFE certificate source gets the client identity and trust roots from the SPIFFE Workload API and does not support custom key exchange groups.
* An entry in the `verifySubjectAltNames` setting is not a valid DNS name, IP address, or URI.
* The `insecureSkipVerify` setting is `Hostname`, but no CA certificate can be loaded, such as when every `caCertificateRefs` entry is invalid.
* The TLS crypto provider of the proxy does not support an entry in the `keyExchangeGroups` setting.

Every request to the backend fails until you fix the setting. This rule also applies when you update a working policy with an invalid setting, because the proxy does not keep the previous TLS settings for that backend.

To find the error, check the proxy logs. The proxy logs a warning when it receives the invalid settings from the controller, and an error for each failed request. The log line for the warning shows `type=Nack`, but the proxy still applies the update, so requests to the backend fail.

```sh
kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} deploy/agentgateway-proxy | grep -i "backend TLS policy"
```

Example output for an {{< reuse "agw-docs/snippets/policy.md" >}} named `nginx-backend-tls` whose `mtlsCertificateRef` Secret has an invalid `ca.crt` value:

```
... type=Nack error="[{\"key\":\"policy/agentgateway-system/nginx-backend-tls:tls:agentgateway-system/nginx.agentgateway-system.svc.cluster.local/8443\",\"warn\":\"invalid backend TLS policy, requests to the backend will fail: base64 decode error: InvalidCharacter(33)\"}]"
... http.status=503 protocol=http error="processing failed: backend TLS policy is invalid: base64 decode error: InvalidCharacter(33)" reason=Internal duration=0ms
```

The response body that the client receives is `internal error`.

### Invalid CA certificate references {#invalid-ca-refs}

The controller checks the CA certificates that a `caCertificateRefs` entry refers to. This check applies to a BackendTLSPolicy, an {{< reuse "agw-docs/snippets/policy.md" >}}, and an {{< reuse "agw-docs/snippets/backend.md" >}}. If the ConfigMap or Secret does not hold a valid CA certificate, the controller reports the error in the resource status:

* A BackendTLSPolicy reports an `Accepted` condition of `False`, with the `NoValidCACertificate` reason.
* An {{< reuse "agw-docs/snippets/policy.md" >}} or an {{< reuse "agw-docs/snippets/backend.md" >}} reports the `PartiallyValid` reason.

The gateway proxy then trusts no CA certificate for that backend. It does not use the system CA certificates instead. The TLS handshake fails, and requests return a 503 HTTP response code with the `upstream connection failed` response body. The proxy logs record `invalid peer certificate: UnknownIssuer`.

For more information about the backend TLS settings, see the [API docs]({{< link-hextra path="/reference/api/#backendtls" >}}).

{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

### In-cluster service

```sh
kubectl delete deployment,service,backendtlspolicy,configmap,httproute -A -l app=nginx
kubectl delete secret nginx-server-cert -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete configmap ca -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```

Remove the certificates that you created.

```sh
cd .. && rm -rf example_certs
```

### External service

Delete the resources that you created. 

```sh
kubectl delete httproute httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete backendtlspolicy httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} httpbin-org -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}
### CA certificate in a ClusterTrustBundle

```sh
kubectl delete clustertrustbundle example-ca --ignore-not-found
```
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
### CA certificate in a Secret

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} nginx-backend-tls -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete secret nginx-ca nginx-ca-custom-key -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
{{< /version >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x" >}}
### Client certificate from files

```sh
kubectl delete deployment,service,configmap,httproute -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l app=nginx-mtls
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} nginx-mtls-tls -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete secret nginx-mtls-ca backend-client-cert -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```

Detach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource from the Gateway, and then delete it. The proxy pod restarts. If the Gateway referenced a parameters resource before you started this section, restore that reference instead.

```sh
kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type json -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]'
kubectl delete {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} backend-mtls-files -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
{{< /version >}}

