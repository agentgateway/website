Authorization policies in agentgateway let you control which requests are allowed to reach your backends. Policies apply across all traffic types — HTTP routes, LLM providers, MCP servers, and agents — giving you a unified way to enforce access rules.

For a general overview of how policies are structured, see [Policy sections]({{< link-hextra path="/about/policies/overview/" >}}).

## How authorization works

Agentgateway uses the `authorization` field inside an {{< reuse "agw-docs/snippets/policy.md" >}} to evaluate whether an incoming request should be allowed or rejected. Authorization rules are expressed as [Common Expression Language (CEL)]({{< link-hextra path="/reference/cel/" >}}) expressions, which let you match on request headers, JWT claims, source IP addresses, MCP tool names, and more.

The `authorization` field can appear in three places in a Kubernetes policy:

| Policy section | Field path | Use case |
|---|---|---|
| `traffic` | `spec.traffic.authorization` | Control access to HTTP routes, LLM backends, or general traffic. |
| `frontend` | `spec.frontend.networkAuthorization` | Layer 4 network-level authorization on downstream connections (such as source IP filtering). |
| `backend.mcp` | `spec.backend.mcp.authorization` | Control access to specific MCP servers or tools. |

> [!NOTE]
> In standalone deployment mode, the frontend network authorization path is `frontendPolicies.networkAuthorization`.

Each authorization block contains a single `action` and a `policy` with `matchExpressions`. Because an authorization block takes only one action, a configuration that needs more than one action must be split across multiple {{< reuse "agw-docs/snippets/policy.md" >}} resources. For an example, see [Combine Allow with Require](#combine-allow-with-require).

### Authorization actions

| Action | Behavior |
|---|---|
| `Allow` | Grants access when at least one expression in the policy matches, so multiple expressions are OR'd together. If any `Allow` rule is configured, requests that match none of them are denied. This is the recommended action for most use cases. |
| `Require` | Grants access only when every expression evaluates to `true`, so multiple expressions are AND'd together. Use `Require` to add mandatory conditions that must hold no matter which `Allow` rules match. See the [Require example](#combine-allow-with-require). |
| `Deny` | Denies access when at least one expression matches, and overrides a matching `Allow`. See the [warning and example below](#deny-policies). |

### Evaluation order

When {{< reuse "agw-docs/snippets/policy.md" >}} resources are applied to a Gateway, their authorization rules are combined and evaluated as follows:

1. `Deny` rules are evaluated first. If any `Deny` expression matches, the request is denied, even if an `Allow` rule also matches.
2. `Require` rules are evaluated next. If any `Require` expression is `false`, the request is denied.
3. `Allow` rules are evaluated last. If at least one `Allow` rule is configured, then at least one `Allow` expression must match, or the request is denied.

> [!NOTE]
> Step 3 applies only when at least one `Allow` rule exists. A policy that contains only `Require` rules allows any request that satisfies all of those rules, because there is no allowlist to check against.

This makes `Allow` and `Require` the recommended combination for safe, readable policies.

Note that authorization runs only after authentication succeeds. A request with a missing, malformed, or unverifiable JWT fails JWT authentication and returns a `401` before any authorization expression is evaluated. Authorization denials return a `403`.

## Setup and test authorization

This section walks you through an end-to-end authorization setup that allows requests from one user and denies requests from another.

### Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

### 1. Apply the authorization policy

Apply an {{< reuse "agw-docs/snippets/policy.md" >}} that validates JWTs and allows only requests from the user `alice`.

```yaml {paths="authorization"}
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: authz-guide
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    jwtAuthentication:
      mode: Strict
      providers:
        - issuer: solo.io
          jwks:
            inline: '{"keys":[{"use":"sig","kty":"RSA","kid":"5891645032159894383","n":"5Zb1l_vtAp7DhKPNbY5qLzHIxDEIm3lpFYhBTiZyGBcnre8Y8RtNAnHpVPKdWohqhbihbVdb6U7m1E0VhLq7CS7k2Ng1LcQtVN3ekaNyk09NHuhl9LCgqXT4pATt6fYTKtZ__tEw4XKt3QqVcw7hV0YaNVC5xXGYVBh5_2-K5aW9u2LQ7FSax0jPhWdoUB3KbOQfWNOA3RwOqYn4gmc9wVToVLv6bXCVhIYWKnAVcX89C00eM7uBHENvOydD14-ZnLb4pzz2VGbU6U65odpw_i4r_mWXvoUgwogXAXp80TsYwMzLHcFo4GVDNkaH0hjuLJCeISPfYtbUJK6fFaZGBw","e":"AQAB"}]}'
    authorization:
      action: Allow
      policy:
        matchExpressions:
          - "jwt.sub == 'alice'"
EOF
```

{{< doc-test paths="authorization" >}}
YAMLTest -f - <<'EOF'
- name: wait for the authorization policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: authz-guide
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
|---|---|
| `jwtAuthentication` | Validates the JWT on the incoming request. Authorization expressions that reference `jwt` require this section, because the `jwt` context exists only after a token is verified. In this example, a local JWKS is provided inline. For more options, see [JWT auth]({{< link-hextra path="/security/jwt/" >}}). |
| `authorization.action` | The authorization action to take. Use `Allow` for allowlisting. |
| `authorization.policy.matchExpressions` | A list of CEL expressions. For an `Allow` action, at least one expression must match (OR logic). For a `Require` action, all expressions must evaluate to `true` (AND logic). |

For a full list of available CEL variables you can use in expressions, see the [CEL reference]({{< link-hextra path="/reference/cel/variables/" >}}).

### 2. Save the JWT tokens

Save JWT tokens for the users Alice and Bob. Both tokens are signed by the key in the JWKS that you applied in the previous step, so both pass authentication. Only Alice's token satisfies the authorization rule.

You can optionally create other JWT tokens by using the [JWT generator tool](https://github.com/kgateway-dev/kgateway/blob/main/hack/utils/jwt/jwt-generator.go). Note that to use JWTs with agentgateway proxies, make sure that the JWTs return Key ID (`kid`) and expiration date (`exp`) values in the JWT header.

1. Save the JWT token for Alice, whose `sub` claim is `alice`.

   ```sh {paths="authorization"}
   export ALICE_JWT="eyJhbGciOiJSUzI1NiIsImtpZCI6IjU4OTE2NDUwMzIxNTk4OTQzODMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJzb2xvLmlvIiwic3ViIjoiYWxpY2UiLCJleHAiOjIwNzM2NzA0ODIsIm5iZiI6MTc2NjA4NjQ4MiwiaWF0IjoxNzY2MDg2NDgyfQ.C-KYZsfWwlwRw4cKHXWmjN5bwWD80P0CVYP6-mT5sX6BH3AR1xNrOApPF9X0plwVD4_AsWzVo435j1AmgBzPwIjhHPKtxXycaKEwSEHYFesyi-XCEJtaQZZVcjOJOs-12L2ZJeM_csk9EqKKSx0oj3jj6BciqBnLn6_hK9sEtoGenEVWEdOpkjRQBxk1m-rVZNY2IvxXMuj9C7jGXv_Sn3cU5w6arXWUsdoQtYTl5tmuF15nkD3DnQfLjDyz59FTKXUR_QkhXV81amejrDSTroJ42_RLC9ABXqdMORCe-Hus-f1utLURfAYGvmnEVeYJO8BFhedTR6lFLnVS0u2Fpw"
   ```

2. Save the JWT token for Bob, whose `sub` claim is `bob`.

   ```sh {paths="authorization"}
   export BOB_JWT="eyJhbGciOiJSUzI1NiIsImtpZCI6IjU4OTE2NDUwMzIxNTk4OTQzODMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJzb2xvLmlvIiwic3ViIjoiYm9iIiwiZXhwIjoyMDczNjcwNDgyLCJuYmYiOjE3NjYwODY0ODIsImlhdCI6MTc2NjA4NjQ4Mn0.ZHAw7nbANhnYvBBknN9_ORCQZ934Vv_vAelx8odC3bsC5Yesif7ZSsnEp9zFjGG6wBvvV3LrtuBuWx9mTYUZS6rwWUKsvDXyheZXYRmXndOqpY0gcJJaulGGqXncQDkmqDA7ZeJLG1s0a6shMXRs6BbV370mYpu8-1dZdtikyVL3pC27QNei35JhfqdYuMw1fMptTVzypx437l9j2htxqtIVgdWUc1iKD9kNKpkJ5O6SNbi6xm267jZ3V_Ns75p_UjLq7krQIUl1W0mB0ywzosFkrRcyXsBsljXec468hgHEARW2lec8FEe-i6uqRuVkFD-AeXMfPhXzqdwysjG_og"
   ```

### 3. Verify the policy

1. Send a request without a JWT. The request fails JWT authentication before authorization runs, so you get back a `401 Unauthorized` response.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   HTTP/1.1 401 Unauthorized
   ```

   {{< doc-test paths="authorization" >}}
   code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
     "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com")
   if [ "$code" != "401" ]; then
     echo "expected 401 for a request with no JWT, got $code"
     exit 1
   fi
   echo "OK: request with no JWT returned 401"
   {{< /doc-test >}}

2. Send a request with Bob's JWT. The token is valid, so authentication succeeds, but the `sub` claim does not match the `Allow` expression. You get back a `403 Forbidden` response.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com" \
    -H "Authorization: Bearer $BOB_JWT"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com" \
    -H "Authorization: Bearer $BOB_JWT"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   HTTP/1.1 403 Forbidden
   ```

   {{< doc-test paths="authorization" >}}
   code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
     "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" \
     -H "Authorization: Bearer ${BOB_JWT}")
   if [ "$code" != "403" ]; then
     echo "expected 403 for Bob's JWT, got $code"
     exit 1
   fi
   echo "OK: valid JWT that does not match the Allow rule returned 403"
   {{< /doc-test >}}

3. Send a request with Alice's JWT. The token is valid and the `sub` claim matches the `Allow` expression, so the request succeeds.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com" \
    -H "Authorization: Bearer $ALICE_JWT"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com" \
    -H "Authorization: Bearer $ALICE_JWT"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   HTTP/1.1 200 OK
   ```

   {{< doc-test paths="authorization" >}}
   code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
     "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" \
     -H "Authorization: Bearer ${ALICE_JWT}")
   if [ "$code" != "200" ]; then
     echo "expected 200 for Alice's JWT, got $code"
     exit 1
   fi
   echo "OK: valid JWT that matches the Allow rule returned 200"
   {{< /doc-test >}}

## More examples

### Combine Allow with Require

An authorization block takes a single `action`, so to combine an `Allow` rule with a `Require` rule, create two {{< reuse "agw-docs/snippets/policy.md" >}} resources that target the same Gateway. Their rules are combined, and a request must satisfy both.

The following policy adds a `Require` rule to the `Allow` policy from the previous section. The `Require` rule enforces an internal-traffic header on every request, no matter which `Allow` rules are defined.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: authz-require
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    authorization:
      action: Require
      policy:
        matchExpressions:
          - "request.headers['x-internal'] == 'true'"
EOF
```

With both policies applied, only Alice's requests that also carry the `x-internal: true` header succeed.

| Request | `Allow` (`jwt.sub == 'alice'`) | `Require` (`x-internal: true`) | Result |
|---|---|---|---|
| Alice's JWT, with the header | Matches | Satisfied | `200` |
| Alice's JWT, no header | Matches | Not satisfied | `403` |
| Bob's JWT, with the header | No match | Satisfied | `403` |
| Bob's JWT, no header | No match | Not satisfied | `403` |

> [!TIP]
> Use `Require` when you need to enforce a mandatory condition across all traffic, such as requiring an internal header, a valid JWT group claim, or a specific source address range. Because a failed `Require` check always denies the request, `Require` cannot be bypassed by adding another `Allow` rule.

### Deny policies

> [!WARNING]
> The `Deny` action is available but is **not recommended** for most use cases. `Deny` rules are error-prone because they often require double-negative logic. For example, to block traffic from outside a valid group, you might attempt to write an expression like `jwt.group != 'eng'`. However, if the JWT does not contain a `group` claim at all, this expression evaluates to `false` and the rule does not fire — silently allowing requests you intended to block.
>
> Use the `Require` action instead. `Require` inverts the logic so you write positive conditions: `action: Require` with `jwt.group == 'eng'`. This is clearer and safer. If you must test whether a claim is present, use the `has()` function, such as `has(jwt.group) && jwt.group == 'eng'`. For more information, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}).

If you must use `Deny`, prefer expressions over request attributes that are always present, such as the request path. The following example blocks access to the `/admin` path for every client, including clients that a separate `Allow` rule permits.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: authz-deny
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    authorization:
      action: Deny
      policy:
        matchExpressions:
          - "request.path.startsWith('/admin')"
EOF
```

### Restrict access by source address

The `source.address` variable is an IP-typed value, not a string, so you cannot compare it to a CIDR string directly. Use the `cidr()` function with `containsIP()` instead, as shown in the following `Require` rule.

```yaml
traffic:
  authorization:
    action: Require
    policy:
      matchExpressions:
        - "cidr('10.0.0.0/8').containsIP(source.address)"
```

> [!WARNING]
> `source.address` is the peer address of the connection as the gateway observes it, which is not always the original client address. If the connection passes through a cloud load balancer or another proxy, or if source IP preservation is not configured, `source.address` is that intermediate address. Verify which address your gateway actually sees before you rely on it, because a `Require` rule that never matches denies every request.

For Layer 4 network-level filtering on downstream connections, use `spec.frontend.networkAuthorization` instead.

### MCP authorization

You can apply authorization policies specifically to MCP servers using the `spec.backend.mcp.authorization` field in an {{< reuse "agw-docs/snippets/policy.md" >}}. This lets you control which clients or JWT token holders can access specific MCP tools.

For a complete guide with examples, see [JWT auth for MCP services]({{< link-hextra path="/mcp/mcp-access/" >}}).

### JWT authorization

To use JWT claims in authorization policies, you first need to configure JWT authentication in the same policy using `spec.traffic.jwtAuthentication`, as shown in [Setup and test authorization](#setup-and-test-authorization). Without it, the `jwt` context does not exist, every expression that references `jwt` fails to match, and the policy denies all traffic while still reporting as accepted and attached.

After the gateway validates a JWT, the decoded claims are available in CEL expressions as top-level fields on `jwt`, such as `jwt.sub` or `jwt.group`.

For setup instructions and examples, see [JWT auth]({{< link-hextra path="/security/jwt/" >}}).

For a list of available JWT variables, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} authz-guide -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} authz-require -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} authz-deny -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
