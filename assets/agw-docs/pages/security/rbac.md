Use Common Expression Language (CEL) expressions to control which requests reach your backends.

## About CEL-based RBAC

Agentgateway proxies use CEL expressions to match requests or responses on specific parameters, such as a request header or a source address. If a request matches the condition, the proxy allows it. Requests that do not match any of the conditions are denied.

The policy matches on request attributes rather than on the type of destination, so CEL-based RBAC applies to any backend, including HTTP services, LLM providers, MCP servers, and agents.

For the variables that you can use in expressions, see the [CEL reference]({{< link-hextra path="/reference/cel/variables/" >}}). For the other authorization actions and the order that the proxy evaluates them in, see [Authorization]({{< link-hextra path="/security/authorization/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Set up RBAC permissions

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with your CEL rules. The following example allows requests that include the `x-team: engineering` header, and denies every other request to the httpbin route.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: rbac-policy
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
   > This example matches a header that the client sets, which demonstrates the mechanism but does not verify who sent the request. To make an authorization decision based on a verified identity, match on a JWT claim instead, as in [Authorization]({{< link-hextra path="/security/authorization/" >}}).

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
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} rbac-policy -n httpbin
```
