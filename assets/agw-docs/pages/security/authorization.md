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

Each authorization rule block contains an `action` and a `policy` with `matchExpressions`.

### Authorization actions

| Action | Behavior |
|---|---|
| `Allow` | Grants access only when at least one expression in the policy matches. Requests that do not match any rule are denied by default. This is the recommended action for most use cases. See the [Allow example](#allow-requests-by-jwt-claim). |
| `Require` | All `Require` expressions must evaluate to `true` for the request to proceed. If any expression evaluates to `false`, the request is denied. Use `Require` to add mandatory conditions that must be satisfied alongside any `Allow` rules. See the [Require example](#require-a-condition-across-all-rules). |
| `Deny` | Denies access when the expression matches. See the [warning and example below](#deny-policies). |

### Evaluation order

When an {{< reuse "agw-docs/snippets/policy.md" >}} is applied to a Gateway, it processes authorization as follows:

1. All `Require` rules are evaluated first. If any `Require` expression is `false`, the request is denied immediately.
2. `Allow` rules are evaluated next. At least one `Allow` expression must match.
3. If no `Allow` rule matches, the request is denied.

This makes `Allow` and `Require` the recommended combination for safe, readable policies.

## Setup and test authorization

This section walks you through a basic authorization setup using JWT claims.

### Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

### 1. Apply the authorization policy

Apply a policy that requires a valid JWT with the claim `group: eng` to access the gateway.

```yaml
kubectl apply -f - <<EOF
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
        - issuer: "https://example.com"
          jwks:
            inline: '{"keys":[]}'
    authorization:
      action: Allow
      policy:
        matchExpressions:
          - "jwt.group == 'eng'"
EOF
```

### 2. Test the policy

Get the gateway URL:

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

Make a request without a JWT to see the expected error:

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
curl -i http://$INGRESS_GW_ADDRESS/ -H "host: www.example.com"
```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
```sh
curl -i http://localhost:8080/ -H "host: www.example.com"
```
{{% /tab %}}
{{< /tabs >}}

Example output:
```
HTTP/1.1 401 Unauthorized
...
```

Make a request with a JWT that does not have the `group: eng` claim:

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
curl -i http://$INGRESS_GW_ADDRESS/ -H "host: www.example.com" -H "Authorization: Bearer <INVALID_JWT>"
```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
```sh
curl -i http://localhost:8080/ -H "host: www.example.com" -H "Authorization: Bearer <INVALID_JWT>"
```
{{% /tab %}}
{{< /tabs >}}

Example output:
```
HTTP/1.1 403 Forbidden
...
```

Make a request with a valid JWT containing the `group: eng` claim to see success:

{{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
curl -i http://$INGRESS_GW_ADDRESS/ -H "host: www.example.com" -H "Authorization: Bearer <VALID_JWT>"
```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
```sh
curl -i http://localhost:8080/ -H "host: www.example.com" -H "Authorization: Bearer <VALID_JWT>"
```
{{% /tab %}}
{{< /tabs >}}

Example output:
```
HTTP/1.1 200 OK
...
```

## More examples

### Allow requests by JWT claim

The following example uses an `Allow` action to grant access to requests that include a specific JWT claim. Requests without a matching JWT or with an incorrect claim are denied.

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: authz-policy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  traffic:
    authorization:
      action: Allow
      policy:
        matchExpressions:
          - "jwt.group == 'eng'"
EOF
```

| Field | Description |
|---|---|
| `action` | The authorization action to take when the expressions match. Use `Allow` for allow-listing. |
| `policy.matchExpressions` | A list of CEL expressions. For an `Allow` action, at least one expression must match (OR logic). For a `Require` action, all expressions must evaluate to `true` (AND logic). |

For a full list of available CEL variables you can use in expressions, see the [CEL reference]({{< link-hextra path="/reference/cel/variables/" >}}).

### Require a condition across all rules

The following example combines an `Allow` rule with a `Require` rule. The `Require` rule ensures that access is only ever granted from a specific source address range, regardless of what `Allow` rules are defined.

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: authz-require-policy
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
          - "cidr('10.0.0.0/8').containsIP(source.address)"
EOF
```

> [!TIP]
> Use `Require` when you need to enforce a mandatory condition across all traffic, such as restricting access to internal IP ranges, requiring a valid JWT group claim, or blocking banned source addresses. `Require` is evaluated before `Allow` rules, so a failed `Require` check always denies the request.

### Deny policies

> [!WARNING]
> The `Deny` action is available but is **not recommended** for most use cases. `Deny` rules are error-prone because they often require double-negative logic. For example, to block traffic from outside a valid group, you might attempt to write an expression like `jwt.group != 'eng'`. However, if the JWT does not contain a `group` claim at all, this expression evaluates to `false` and the rule does not fire — silently allowing requests you intended to block.
>
> Use the `Require` action instead. `Require` inverts the logic so you write positive conditions: `action: Require` with `jwt.group == 'eng'`. This is clearer and safer.

If you must use `Deny`, here is an example that blocks traffic from a specific IP range:

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: authz-deny-policy
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
          - "cidr('10.0.0.0/8').containsIP(source.address)"
EOF
```

### MCP authorization

You can apply authorization policies specifically to MCP servers using the `spec.backend.mcp.authorization` field in an {{< reuse "agw-docs/snippets/policy.md" >}}. This lets you control which clients or JWT token holders can access specific MCP tools.

For a complete guide with examples, see [JWT auth for MCP services]({{< link-hextra path="/mcp/mcp-access/" >}}).

### JWT authorization

To use JWT claims in authorization policies, you first need to configure JWT authentication in the same policy using `spec.traffic.jwtAuthentication`. After the gateway validates a JWT, the decoded claims are available in CEL expressions using variables such as `jwt.sub` or `jwt.group`.

For setup instructions and examples, see [JWT auth]({{< link-hextra path="/security/jwt/" >}}).

For a list of available JWT variables, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} authz-guide -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
