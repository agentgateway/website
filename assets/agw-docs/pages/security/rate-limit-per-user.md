## Per-user rate limiting {#per-user}

The limit that you applied in the previous section is shared by every request on the route, so one busy client can exhaust it for everyone else. To give each client its own limit, set the `key` field to a CEL expression. Each distinct value that the expression returns gets its own token bucket with the limits of that rule, which means you can enforce per-user limits without an external rate limit service.

1. Update the rate limit policy to key the limit on a user header. In production, prefer a value that the client cannot choose, such as the `jwt.sub` claim from a [JWT authentication policy]({{< link-hextra path="/documentation/security/jwt/" >}}).

   ```yaml {paths="per-user-rate-limit"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: httpbin-per-user-rate-limit
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       rateLimit:
         local:
         - requests: 2
           unit: Minutes
           key: 'request.headers["x-user"]'
   EOF
   ```

   {{< doc-test paths="per-user-rate-limit" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for the per-user rate limit policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: httpbin
           name: httpbin-per-user-rate-limit
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

2. Send three requests as one user. The first two succeed, and the third is rejected.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in $(seq 1 3); do
     curl -s -o /dev/null -w "alice request $i: HTTP %{http_code}\n" \
       http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com" -H "x-user: alice"
   done
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   for i in $(seq 1 3); do
     curl -s -o /dev/null -w "alice request $i: HTTP %{http_code}\n" \
       localhost:8080/headers -H "host: www.example.com" -H "x-user: alice"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   alice request 1: HTTP 200
   alice request 2: HTTP 200
   alice request 3: HTTP 429
   ```

3. Send requests as a second user. These requests succeed, because each user has an independent bucket.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in $(seq 1 3); do
     curl -s -o /dev/null -w "bob request $i: HTTP %{http_code}\n" \
       http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com" -H "x-user: bob"
   done
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   for i in $(seq 1 3); do
     curl -s -o /dev/null -w "bob request $i: HTTP %{http_code}\n" \
       localhost:8080/headers -H "host: www.example.com" -H "x-user: bob"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   bob request 1: HTTP 200
   bob request 2: HTTP 200
   bob request 3: HTTP 429
   ```

   {{< doc-test paths="per-user-rate-limit" >}}
   # Drain one user's bucket, then confirm that a different user still gets through.
   for i in $(seq 1 3); do
     curl -s -o /dev/null http://${INGRESS_GW_ADDRESS}:80/anything \
       -H "host: www.example.com" -H "x-user: alice"
   done

   YAMLTest -f - <<'EOF'
   - name: the drained user is rate limited
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything"
       method: GET
       headers:
         host: www.example.com
         x-user: alice
     source:
       type: local
     expect:
       statusCode: 429
     retries: 3
   - name: a different user has its own bucket
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/anything"
       method: GET
       headers:
         host: www.example.com
         x-user: bob
     source:
       type: local
     expect:
       statusCode: 200
   EOF
   {{< /doc-test >}}

Review the following behavior before you rely on a keyed limit.

* **Requests without a value**: Requests whose key is empty, or whose expression cannot be evaluated, such as a request with no `x-user` header in this example, all share one bucket. An empty key does not exempt a request from the limit. To apply a limit to only some requests, use [conditional policies]({{< link-hextra path="/documentation/about/policies/conditional-policies" >}}) instead.
* **How many buckets are kept**: Each rule keeps up to 65,536 buckets and drops the least recently used ones, which for that key is the same as never having been seen.
* **Where buckets live**: Buckets are held in memory by a single proxy replica, so each replica enforces the limit separately. For a limit that is shared across replicas, use [global rate limiting](#global).
* **Invalid expressions**: If the expression does not compile, the policy is accepted with the `PartiallyValid` reason, and the rest of the policy still applies. Check the policy status for the message `local rate limit key is not a valid CEL expression`.

For the variables that you can read in a key, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).

### Clean up the per-user policy

```sh {paths="per-user-rate-limit"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} httpbin-per-user-rate-limit -n httpbin
```
