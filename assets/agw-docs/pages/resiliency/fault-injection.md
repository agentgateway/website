Inject artificial latency into requests with an {{< reuse "agw-docs/snippets/policy.md" >}} to test how your clients and upstream services handle slow responses. Fault injection is useful for verifying that timeouts, retries, and client-side deadlines behave as expected. To learn more, you can use fault injection alongside [Timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/" >}}) and [Retries]({{< link-hextra path="/documentation/resiliency/retry/" >}}).

The injected delay counts against the request timeout. If the delay is longer than the configured [request timeout]({{< link-hextra path="/documentation/resiliency/timeouts/" >}}), the request times out.

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Inject a delay {#inject-a-delay}

1. Create an HTTPRoute for the httpbin app.
   ```yaml
   kubectl apply -n httpbin -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin-delay
     namespace: httpbin
   spec:
     hostnames:
     - faultinjection.example
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - backendRefs:
       - kind: Service
         name: httpbin
         port: 8000
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that injects a fixed 2-second delay into the requests that the HTTPRoute handles.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: httpbin-delay
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin-delay
     traffic:
       delay:
         duration: 2s
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Description |
   | -- | -- |
   | `targetRefs` | The route, gateway, or listener to apply the delay to. In this example, the policy targets the `httpbin-delay` HTTPRoute. |
   | `traffic.delay.duration` | The latency to inject before the request is forwarded to the backend. Set either a duration string, such as `2s` or `500ms`, or a CEL expression that is evaluated against the request. For more information, see [Inject a probabilistic or random delay](#inject-a-probabilistic-or-random-delay). |

3. Send a request along the route and verify that the response is delayed by about 2 seconds.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s -o /dev/null -w "%{time_total}s\n" http://$INGRESS_GW_ADDRESS/get -H "host: faultinjection.example"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -s -o /dev/null -w "%{time_total}s\n" localhost:8080/get -H "host: faultinjection.example"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console
   2.01s
   ```

4. Optional: Verify that the delay policy is applied in the proxy configuration.

   1. Port-forward the gateway proxy on port 15000.
      ```sh
      kubectl port-forward deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Find the delay policy in the config dump.
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.traffic.delay?)] | .[0]'
      ```

## Inject a probabilistic or random delay {#inject-a-probabilistic-or-random-delay}

Because `duration` accepts a CEL expression, you can inject latency into only a subset of requests, or add jitter. The expression is evaluated against each request and returns either a duration or a number that is interpreted as milliseconds. A non-positive result injects no delay.

| Expression | Effect |
| -- | -- |
| `duration("500ms")` | A fixed 500ms delay, expressed as a CEL duration. |
| `random() < 0.1 ? 500 : 0` | A 500ms delay on approximately 10% of requests, and no delay otherwise. |
| `int(random() * 500.0)` | A random delay between 0 and 500ms (jitter) on every request. |

For example, the following policy delays approximately 10% of requests by 500ms.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: httpbin-delay
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin-delay
  traffic:
    delay:
      duration: "random() < 0.1 ? 500 : 0"
EOF
```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.

```sh
kubectl delete httproute httpbin-delay -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} httpbin-delay -n httpbin
```
