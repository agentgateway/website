## Claim-level rate limits {#claim-level}

Create claim-level rate limits with CEL expressions.

The limit that you applied in the previous section is shared by every request on the route, so one busy client can exhaust it for everyone else. To limit each caller separately, set the `key` field to a CEL expression. Each distinct value that the expression returns gets its own token bucket with the limits of that rule. The expression typically reads a claim in a JWT, such as `jwt.sub` for a limit per user, `jwt.team` for a limit per team, or `jwt.sub + "/" + request.path` for a limit per user per path. This way, you can enforce claim-level limits without an external rate limit service.

In production, key the limit on a value that the client cannot choose, which means a claim from a [JWT authentication policy]({{< link-hextra path="/documentation/security/jwt/" >}}) that targets the same route.

```yaml
    rateLimit:
      local:
      - requests: 2
        unit: Minutes
        key: jwt.sub
```

The following steps key the limit on a request header instead, so that you can see the behavior without an identity provider.

1. Update the rate limit policy to key the limit on a user header.

   ```yaml {paths="claim-level-rate-limit"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: httpbin-claim-level-rate-limit
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

   {{< doc-test paths="claim-level-rate-limit" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for the claim-level rate limit policy to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: httpbin
           name: httpbin-claim-level-rate-limit
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

   {{< doc-test paths="claim-level-rate-limit" >}}
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

Review the following behavior before you rely on a claim-level limit.

* **Requests without a value**: Requests whose key is empty, or whose expression cannot be evaluated, such as a request with no `x-user` header in this example, all share one bucket. An empty key does not exempt a request from the limit. To apply a limit to only some requests, use [conditional policies]({{< link-hextra path="/documentation/about/policies/conditional-policies" >}}) instead.
* **How many buckets are kept**: Each rule keeps up to 65,536 buckets and drops the least recently used ones, which for that key is the same as never having been seen.
* **Where buckets live**: Buckets are held in memory by a single proxy replica, so each replica enforces the limit separately. For a limit that is shared across replicas, use [global rate limiting](#global).
* **Invalid expressions**: If the expression does not compile, the policy is accepted with the `PartiallyValid` reason, and the rest of the policy still applies. Check the policy status for the message `local rate limit key is not a valid CEL expression`.

For the variables that you can read in a key, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).

### Clean up the claim-level policy

```sh {paths="claim-level-rate-limit"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} httpbin-claim-level-rate-limit -n httpbin
```
