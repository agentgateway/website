Use [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) to inject, modify, and remove response headers. The example uses the `request.headers[]` context variable to extract a request header value and injects the value into a response header. You also explore how to combine  `set`, `add`, and `remove` operations in a single transformation.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Inject response headers

The gateway intercepts the upstream response and modifies its headers before returning them to the client. You can combine `set`, `add`, and `remove` operations in a single policy so that the gateway applies all three operations in one pass. This configuration is useful when you need to enrich responses with values from the original request or strip internal headers that should not reach the client.

In this example, all three operations are applied together:

* `x-gateway-response` (`set`): Reads the value of the `x-gateway-request` request header and sets it as a response header.
* `x-response-raw` (`set`): Set to the static value `hello`.
* `access-control-allow-origin` (`add`): Adds `https://example.com`. Because httpbin already returns the `access-control-allow-origin: *` header, another `access-control-allow-origin` header is added to the response with the `https://example.com` value. To not add multiple headers with the same key to a response, use the `set` operation instead. This operation overwrites the value of any existing headers that are sent in the response. 
* `access-control-allow-credentials` (`remove`): Strips the header from the response before it reaches the client.


1. Send a request to the httpbin app. The `access-control-allow-origin` header exists before setting the {{< reuse "agw-docs/snippets/policy.md" >}}.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" 
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[3,4,5,6]}
   ...
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 3
   content-length: 3
   ```

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource with your transformation rules.

   ```yaml {paths="inject-response-headers"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: transformation
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       transformation:
         response:
           set:
           - name: x-gateway-response
             value: 'request.headers["x-gateway-request"]'
           - name: x-response-raw
             value: '"hello"'
           add:
           - name: access-control-allow-origin
             value: '"https://example.com"'
           remove:
           - access-control-allow-credentials
   EOF
   ```

   {{< doc-test paths="inject-response-headers" >}}
   YAMLTest -f - <<'EOF'
   - name: verify injected response headers are present and removed header is absent
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/response-headers"
       method: GET
       headers:
         host: www.example.com
         x-gateway-request: my-custom-value
     source:
       type: local
     expect:
       statusCode: 200
       headers:
         - name: x-gateway-response
           comparator: equals
           value: my-custom-value
         - name: x-response-raw
           comparator: equals
           value: hello
   EOF
   {{< /doc-test >}}

3. Send a request to the httpbin app and include the `x-gateway-request` request header. Verify the following:
   * You get back a 200 HTTP response code.
   * The response includes the injected headers.
   * The response contains two `access-control-allow-origin` values.
   * The response omits `access-control-allow-credentials`.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/response-headers \
    -H "host: www.example.com:80" \
    -H "x-gateway-request: my-custom-value"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/response-headers \
   -H "host: www.example.com" \
   -H "x-gateway-request: my-custom-value"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console {hl_lines=[3,4,5,6,9,10,15,16,16,16,19,20]}
   ...
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < x-response-raw: hello
   x-response-raw: hello
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < access-control-allow-origin: https://example.com
   access-control-allow-origin: https://example.com
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 3
   content-length: 3
   < x-gateway-response: my-custom-value
   x-gateway-response: my-custom-value
   ```

   `access-control-allow-origin` appears twice: the original `*` from httpbin and the appended `https://example.com` added by the transformation. `access-control-allow-credentials` is absent because it was removed.

<!-- Gated by excluding the older version, not by including "main", so the
     section stays put when the next release freezes this line under a number.
     The `proxy.error` context variable is new in the version that `main`
     currently points at. -->
{{< version exclude-if="1.5.x" >}}
## Explain a gateway error response {#gateway-error}

The examples so far read the request, which means they run on a response that a backend actually returned. When the gateway cannot get a response at all, it synthesizes the error itself, and the `proxy.error` context variable holds why. A response transformation can copy that onto the reply, so a client or a browser network tab shows the cause instead of a bare 503.

| Field | Description |
| -- | -- |
| `proxy.error.reason` | Broad classification of the failure, such as `UpstreamFailure` or `Timeout`. This value is the same value set that the `reason` label on the gateway's request metrics uses, so a response header, a log field, and a metric series can be grouped the same way. |
| `proxy.error.message` | The human-readable detail, such as `upstream call failed: ...`. Treat the exact text as unstable, because it can change between releases. Match on `reason` instead. |

`proxy.error` is set only when the gateway synthesized the response from a failure. The variable is absent when the backend answered, and absent for a [direct response]({{< link-hextra path="/documentation/traffic-management/direct-response/" >}}), which is a reply that you configured rather than an error.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that copies both fields onto the response.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: explain-gateway-error
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       transformation:
         response:
           set:
           - name: x-error-reason
             value: proxy.error.reason
           - name: x-error-message
             value: proxy.error.message
   EOF
   ```

2. Send a request to a route whose backend cannot be reached, such as a Service with no ready endpoints. The gateway returns a 503, and the headers now name the cause.

   ```console
   < HTTP/1.1 503 Service Unavailable
   < x-error-reason: UpstreamFailure
   < x-error-message: upstream call failed: ...
   ```

`reason` takes one of the following values. The set covers every failure the gateway classifies, not only backend failures, so the same header explains a rejected request as well as an unreachable backend.

| Value | The gateway returned an error because |
| -- | -- |
| `NotFound` | No bind, listener, route, or service matched the request. |
| `NoHealthyBackend` | No endpoint was eligible to receive the request, including when DNS did not resolve. |
| `UpstreamFailure` | The call to the backend itself failed. |
| `Timeout` | The request timed out. |
| `InvalidRequest` | The client sent a request the gateway could not accept. |
| `JwtAuth` | JWT authentication failed. |
| `Oidc` | OIDC processing failed. |
| `BasicAuth` | Basic authentication failed. |
| `APIKeyAuth` | API key authentication failed. |
| `ExtAuth` | An external authorization service rejected the request. |
| `Authorization` | An authorization policy denied the request, including a failed CSRF check. |
| `ExtProc` | External processing failed. |
| `RateLimit` | A rate limit was exceeded. |
| `Overload` | The frontend was overloaded and shed the request. |
| `Guardrail` | An LLM guardrail rejected the request. |
| `MCP` | An MCP protocol error occurred that was not a rate limit. |
| `Internal` | Processing failed inside the gateway. This is the fallback, so it covers unrelated causes, and the `message` is the only way to tell them apart. |

> [!NOTE]
> Two values that appear on the request metric's `reason` label never appear here. `Upstream` means the backend answered, and `DirectResponse` means the reply was configured rather than failed, and neither sets `proxy.error`.

The same variable works in an access log field, which is usually the better place for it, because it keeps the reason without exposing internal detail to clients. For more information, see [Add and remove log fields]({{< link-hextra path="/documentation/observability/access-logs/view/#add-and-remove-log-fields" >}}).
{{< /version >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh {paths="inject-response-headers"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} transformation -n httpbin
```
