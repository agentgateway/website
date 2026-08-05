Use Common Expression Language (CEL) expressions to secure access to AI resources and to regular HTTP traffic.

## About CEL-based RBAC

Agentgateway proxies use CEL expressions to match requests or responses on specific parameters, such as a request header or source address. If the request matches the condition, it is allowed. Requests that do not match any of the conditions are denied.

The policy matches on request attributes rather than on the destination, so the same pattern works for any backend. The following sections show it twice: first for an LLM provider, and then for regular HTTP traffic to the httpbin sample app.

For an overview of supported CEL expressions, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Set up access to Gemini

Configure access to an LLM provider such as Gemini. You can use any other LLM provider, an MCP server, or an agent to try out CEL-based RBAC.

{{< reuse "agw-docs/snippets/gemini-setup.md" >}}

## Set up RBAC permissions for an LLM route {#llm-route}

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with your CEL rules. The following example allows requests with the `x-llm: gemini` header.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: rbac-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: google
     traffic:
       authorization:
         action: Allow
         policy:
           matchExpressions:
             - "request.headers['x-llm'] == 'gemini'"
   EOF
   ```

2. Send a request to the LLM provider API without the `x-llm` header. Verify that the request is denied with a 403 HTTP response code.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vik "$INGRESS_GW_ADDRESS:80/gemini" -H content-type:application/json -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "Explain how AI works in simple terms."}
    ]
   }'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vik "localhost:8080/gemini" -H content-type:application/json -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "Explain how AI works in simple terms."}
    ]
   }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   * upload completely sent off: 109 bytes
   < HTTP/1.1 403 Forbidden
   < content-type: text/plain
   < content-length: 20

   authorization failed
   ```

3. Send another request to the LLM provider. This time, you include the `x-llm` header. Verify that the request succeeds with a 200 HTTP response code.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vik "$INGRESS_GW_ADDRESS:80/gemini" \
     -H "content-type: application/json" \
     -H "x-llm: gemini" -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "Explain how AI works in simple terms."}
    ]
   }'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vik "localhost:8080/gemini" \
     -H "content-type: application/json" \
     -H "x-llm: gemini" -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "Explain how AI works in simple terms."}
    ]
   }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

## Set up RBAC permissions for an HTTP route {#http-route}

The same policy pattern restricts access to regular HTTP traffic, such as the httpbin sample app.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with your CEL rules. The following example allows requests that include the `x-team: engineering` header, and denies every other request to the httpbin route.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: rbac-policy-httpbin
     namespace: httpbin
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: HTTPRoute
         name: httpbin
     traffic:
       authorization:
         action: Allow
         policy:
           matchExpressions:
             - "request.headers['x-team'] == 'engineering'"
   EOF
   ```

   > [!NOTE]
   > This example matches a header that the client sets, which demonstrates the mechanism but does not verify who sent the request. To make an authorization decision based on a verified identity, match on a JWT claim instead.

2. Send a request to the httpbin app without the `x-team` header. Verify that the request is denied with a 403 HTTP response code.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   HTTP/1.1 403 Forbidden
   content-type: text/plain
   content-length: 20

   authorization failed
   ```

3. Send another request to the httpbin app. This time, include the `x-team: engineering` header. Verify that the request succeeds with a 200 HTTP response code.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "$INGRESS_GW_ADDRESS:80/headers" -H "host: www.example.com" -H "x-team: engineering"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com" -H "x-team: engineering"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   HTTP/1.1 200 OK
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} rbac-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} rbac-policy-httpbin -n httpbin
kubectl delete httproute google -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} google -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret google-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
