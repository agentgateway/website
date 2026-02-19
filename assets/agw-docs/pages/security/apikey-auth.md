[API keys](https://en.wikipedia.org/wiki/Application_programming_interface_key) are secure, long-lived UUIDs that clients provide when they send a request to your service. You might use API keys in the following scenarios:
* You know the set of users that need access to your service. These users do not change often, or you have automation that easily generates or deletes the API key when the users do change. 
* You want direct control over how the credentials are generated and expire.

{{< callout type="warning" >}}
When you use API keys, your services are only as secure as the API keys. Storing and rotating the API key securely is up to the user.
{{< /callout >}}

## API key auth in agentgateway

The agentgateway proxy comes with built-in API key auth support via the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource. To secure your services with API keys, first provide your agentgateway proxy with your API keys in the form of Kubernetes secrets. Then in the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource, you refer to the secrets in one of two ways.

* Specify a **label selector** that matches the label of one or more API key secrets. Labels are the more flexible, scalable approach.
* Refer to the **name and namespace** of each secret.

The proxy matches a request to a route that is secured by the external auth policy. The request must have a valid API key in the `Authorization` header to be accepted. You can configure the name of the expected header. If the header is missing, or the API key is invalid, the proxy denies the request and returns a `401` response. 

The following diagram illustrates the flow: 

```mermaid
sequenceDiagram
    participant C as Client / Agent
    participant AGW as Agentgateway Proxy
    participant K8s as K8s Secrets<br/>(API Keys)
    participant Backend as Backend<br/>(LLM / MCP / Agent / HTTP)

    C->>AGW: POST /api<br/>(no Authorization header)

    AGW->>AGW: API key auth check:<br/>No API key found

    AGW-->>C: 401 Unauthorized<br/>"no API Key found"

    Note over C,Backend: Retry with API key

    C->>AGW: POST /api<br/>Authorization: Bearer N2YwMDIx...

    AGW->>K8s: Lookup referenced secret<br/>(by name or label selector)
    K8s-->>AGW: Secret found

    AGW->>AGW: Compare API key from<br/>request header vs secret

    alt mode: Strict — Key valid
        AGW->>Backend: Forward request
        Backend-->>AGW: Response
        AGW-->>C: 200 OK + Response
    else Key invalid
        AGW-->>C: 401 Unauthorized
    end

    Note over C,Backend: Optional Mode

    rect rgb(245, 245, 255)
        Note over AGW: mode: Optional<br/>• Valid API key → forward<br/>• Invalid API key → 401 reject<br/>• No API key → allow through
    end
```

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up API key auth

Store your API keys in a Kubernetes secret so that you can reference it in an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource. 

1. From your API management tool, generate an API key. The examples in this guide use `N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy`.

2. Create a Kubernetes secret to store your API key. 

   ```yaml 
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: apikey
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: httpbin
   type: extauth.solo.io/apikey
   stringData:
     api-key: N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy
   EOF
   ```

3. Verify that the secret is created. Note that the `data.api-key` value is base64 encoded. 
   
   ```sh
   kubectl get secret apikey -n {{< reuse "agw-docs/snippets/namespace.md" >}} -oyaml
   ```

4. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that configures API key authentication for all routes that the Gateway serves and reference the `apikey` secret that you created earlier. The following example uses the `Strict` validation mode, which requires request to include a valid `Authorization` header to be authenticated successfully. For other common configuration examples, see [Other configuration examples](#other-configuration-examples).  
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: apikey-auth
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy
     traffic:
       apiKeyAuthentication:
         mode: Strict
         secretRef:
           name: apikey
   EOF
   ```

5. Send a request to the httpbin app without an API key. Verify that the request fails with a 401 HTTP response code. 
   
   {{< tabs tabTotal= "2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com"                                  
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/headers" -H "host: www.example.com" 
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   ...
   < HTTP/1.1 401 Unauthorized
   HTTP/1.1 401 Unauthorized

   api key authentication failure: no API Key found%   
   ...
   ```

6. Repeat the request. This time, you provide a valid API key in the `Authorization` header. Verify that the request now succeeds. 
   {{< tabs tabTotal= "2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "${INGRESS_GW_ADDRESS}:80/headers" \
   -H "host: www.example.com" \
   -H "Authorization: Bearer N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy"                                 
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/headers" \
   -H "host: www.example.com" \
   -H "Authorization: Bearer N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy"  
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   ...
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 148
   content-length: 148
   < 
   
   {
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "www.example.com"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ]
     }
   }
   ...
   ```

## Cleanup 

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} apikey-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret apikey -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Other configuration examples

Review other common configuration examples. 

### Label selectors

Refere to your API key secret by using label selectors. 

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: apikey-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Strict
      secretSelector:
        matchLabels:
          app: httpbin
EOF
```

### Optional validation mode

Use the `Optional` mode to validate API keys when present, but allow requests without an API key. This mode is useful for services that offer both authenticated and unauthenticated access.

{{< callout type="warning" >}}
The `Optional` mode allows requests without an API key. Use this mode only when you intend to allow unauthenticated access to your services.
{{< /callout >}}

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: apikey-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    apiKeyAuthentication:
      mode: Optional
      secretRef:
        name: apikey
EOF
```
