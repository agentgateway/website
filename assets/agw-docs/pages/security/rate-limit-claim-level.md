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

1. Update the `httpbin-rate-limit` policy from the previous section to key the limit on a user header. The rest of the policy is unchanged, so the route keeps one policy rather than gaining a second one.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: httpbin-rate-limit
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

Review the following behavior before you rely on a claim-level limit.

* **Requests without a value**: Requests whose key is empty, or whose expression cannot be evaluated, such as a request with no `x-user` header in this example, all share one bucket. An empty key does not exempt a request from the limit. To apply a limit to only some requests, use [conditional policies]({{< link-hextra path="/documentation/about/policies/conditional-policies" >}}) instead.
* **How many buckets are kept, and where they live**: {{< reuse "agw-docs/snippets/ratelimit-key-buckets.md" >}} For a limit that is shared across replicas, use [global rate limiting](#global).
* **Invalid expressions**: If the expression does not compile, the policy is accepted with the `PartiallyValid` reason, and the rest of the policy still applies. Check the policy status for the message `local rate limit key is not a valid CEL expression`.

For the variables that you can read in a key, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).
