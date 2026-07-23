[API keys](https://en.wikipedia.org/wiki/Application_programming_interface_key) are secure, long-lived UUIDs that clients provide when they send a request to your service. You might use API keys in the following scenarios:
* You know the set of users that need access to your service. These users do not change often, or you have automation that easily generates or deletes the API key when the users do change.
* You want direct control over how the credentials are generated and expire.

{{< callout type="warning" >}}
When you use API keys, your services are only as secure as the API keys. Storing and rotating the API key securely is up to the user.
{{< /callout >}}

## API key auth in agentgateway

The agentgateway proxy comes with built-in API key auth support via the {{< reuse "agw-docs/snippets/policy.md" >}} resource. To secure your services with API keys, first provide your agentgateway proxy with your API keys in the form of Kubernetes secrets. Then in the {{< reuse "agw-docs/snippets/policy.md" >}} resource, you refer to the secrets in one of two ways.

* Specify a **label selector** that matches the label of one or more API key secrets. Labels are the more flexible, scalable approach.
* Refer to the **name and namespace** of each secret.

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}

> [!IMPORTANT]
> ConfigMaps with hashed keys (as opposed to Secrets) are the recommended way to store API keys. If you need to use Kubernetes Secrets, refer to [Store keys in a Secret](#store-keys-in-a-secret).
{{< /version >}}

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

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
Store your API keys in a Kubernetes ConfigMap so that you can reference them in an {{< reuse "agw-docs/snippets/policy.md" >}} resource. Because a ConfigMap is not confidential, each entry stores a SHA-256 hash of the API key (`keyHash`) rather than the raw key. Clients still send the raw key in the `Authorization` header; the proxy hashes the presented key and compares it to the stored hash, so the plaintext key never has to exist in the cluster. This is the recommended way to store API keys. To use a Secret instead, see [Store keys in a Secret](#store-keys-in-a-secret).

1. From your API management tool, generate an API key. The examples in this guide use `N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy`.

2. Generate a `sha256:<hex>` hash of the API key. The hash is computed over the exact key bytes, so do not include a trailing newline.

   ```sh
   printf '%s' 'N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy' | sha256sum
   ```

3. Create a ConfigMap to store your API key hashes. Each entry represents one valid API key, as a JSON object with a `keyHash` and optional `metadata`. Add a label so that the policy can select the ConfigMap.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: apikey
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: httpbin
   data:
     api-key: |
       {
         "keyHash": "sha256:ec831936fbbab1232344d9da271d1629fabc992aef393d7d54735b210d4ff166",
         "metadata": {
           "group": "sales"
         }
       }
   EOF
   ```

4. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that configures API key authentication for all routes that the Gateway serves, and select the `apikey` ConfigMap with `configMapSelector`. The following example uses the `Strict` validation mode, which requires requests to include a valid `Authorization` header to be authenticated successfully. For other common configuration examples, see [Other configuration examples](#other-configuration-examples).

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
         configMapSelector:
           matchLabels:
             app: httpbin
   EOF
   ```

{{< callout type="warning" >}}
Every entry in a selected ConfigMap must use `keyHash`. If an entry uses a raw `key`, that entry is rejected and the policy reports a `PartiallyValid` status, while the valid entries continue to work.
{{< /callout >}}
{{< /version >}}

{{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
Store your API keys in a Kubernetes secret so that you can reference it in an {{< reuse "agw-docs/snippets/policy.md" >}} resource.

1. From your API management tool, generate an API key. The examples in this guide use `N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy`.

2. Create a Kubernetes secret to store your API keys. Each entry in the secret represents one valid API key. The value can be the API key string, or a JSON object with the `key` and optional `metadata` fields.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: apikey
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: httpbin
   stringData:
     api-key: N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy
     client2: RjBiNjcyLWM0YzQtMGJkNC04M2d3LWM1UzNHTi1lWklETXdZMk4
     client3: |
       {
         "key": "YWJjMTIzLTRlZjUtNjc4OS1hYmNkLWVmMTIzNDU2Nzg5MA",
         "metadata": {
           "group": "sales"
         }
       }
   EOF
   ```

3. Verify that the secret is created. Note that the values in the `data` section are base64 encoded.

   ```sh
   kubectl get secret apikey -n {{< reuse "agw-docs/snippets/namespace.md" >}} -oyaml
   ```

4. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that configures API key authentication for all routes that the Gateway serves and reference the `apikey` secret that you created earlier. The following example uses the `Strict` validation mode, which requires request to include a valid `Authorization` header to be authenticated successfully. For other common configuration examples, see [Other configuration examples](#other-configuration-examples).
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
{{< /version >}}

After you apply the policy, verify that API key authentication is enforced.

1. Send a request to the httpbin app without an API key. Verify that the request fails with a 401 HTTP response code.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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

2. Repeat the request. This time, you provide a valid API key in the `Authorization` header. Verify that the request now succeeds.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "${INGRESS_GW_ADDRESS}:80/headers" \
   -H "host: www.example.com" \
   -H "Authorization: Bearer N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
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
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} apikey-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete configmap apikey -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete secret apikey -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```

## Other configuration examples

Review other common configuration examples.

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
### Store keys in a Secret

To store API keys in a Kubernetes Secret instead of a ConfigMap, create a Secret and reference it in the policy with either `secretRef` (a single Secret) or `secretSelector` (multiple Secrets selected by label). Unlike a ConfigMap, a Secret entry can use a raw `key` or a `keyHash`.

1. Create a Secret to store your API keys. Each entry represents one valid API key, as the raw key string or a JSON object with a `key` (or `keyHash`) and optional `metadata`.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: apikey
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: httpbin
   stringData:
     api-key: N2YwMDIxZTEtNGUzNS1jNzgzLTRkYjAtYjE2YzRkZGVmNjcy
     client2: RjBiNjcyLWM0YzQtMGJkNC04M2d3LWM1UzNHTi1lWklETXdZMk4
     client3: |
       {
         "key": "YWJjMTIzLTRlZjUtNjc4OS1hYmNkLWVmMTIzNDU2Nzg5MA",
         "metadata": {
           "group": "sales"
         }
       }
   EOF
   ```

2. Reference the Secret in the {{< reuse "agw-docs/snippets/policy.md" >}}. Reference a single Secret by name with `secretRef`, or select multiple Secrets by label with `secretSelector`.

   {{< tabs >}}
   {{% tab name="Single Secret (secretRef)" %}}
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
   {{% /tab %}}
   {{% tab name="Label selector (secretSelector)" %}}
   Select every Secret that carries a label. For example, both of the following Secrets are selected by the `app: httpbin` label.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: apikey-team-a
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: httpbin
   stringData:
     team-a-key: YXBpa2V5LXRlYW0tYQ
   ---
   apiVersion: v1
   kind: Secret
   metadata:
     name: apikey-team-b
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     labels:
       app: httpbin
   stringData:
     team-b-key: YXBpa2V5LXRlYW0tYg
   EOF
   ```

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
   {{% /tab %}}
   {{< /tabs >}}
{{< /version >}}

{{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
### Label selectors

Refer to API key secrets by using label selectors.

The following two secrets are both selected by the `app: httpbin` label.

```yaml
kubectl apply -f- <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: apikey-team-a
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: httpbin
stringData:
  team-a-key: YXBpa2V5LXRlYW0tYQ
---
apiVersion: v1
kind: Secret
metadata:
  name: apikey-team-b
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: httpbin
stringData:
  team-b-key: YXBpa2V5LXRlYW0tYg
EOF
```

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
{{< /version >}}

### PreRouting phase

By default, API key authentication is enforced during routing. Use the `PreRouting` phase to validate API keys before any routing decision is made. This is useful when you want to enforce authentication for all traffic at the gateway level, regardless of the route.

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: apikey-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    phase: PreRouting
    apiKeyAuthentication:
      mode: Strict
      configMapSelector:
        matchLabels:
          app: httpbin
EOF
```
{{< /version >}}

{{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: apikey-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    phase: PreRouting
    apiKeyAuthentication:
      mode: Strict
      secretRef:
        name: apikey
EOF
```
{{< /version >}}

### Optional validation mode

Use the `Optional` mode to validate API keys when present, but allow requests without an API key. This mode is useful for services that offer both authenticated and unauthenticated access.

{{< callout type="warning" >}}
The `Optional` mode allows requests without an API key. Use this mode only when you intend to allow unauthenticated access to your services.
{{< /callout >}}

{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
      configMapSelector:
        matchLabels:
          app: httpbin
EOF
```
{{< /version >}}

{{< version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" >}}
```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
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
{{< /version >}}
