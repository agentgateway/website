Update the `api-key-auth` {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} from the previous step to also enforce a per-user token budget.

The policy sends a per-user token cost to the rate limit server. It extracts the `user_id` from each API key and reports the token usage of each response under that descriptor. The rate limit server holds the actual budget (100 tokens per day per user), which you deploy in the next step.

```yaml,paths="virtual-keys-with-ratelimit"
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: api-key-auth
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
        name: llm-api-keys
    rateLimit:
      global:
        domain: agentgateway
        backendRef:
          kind: Service
          name: ratelimit
          namespace: ratelimit
          port: 8081
        descriptors:
          - entries:
              - name: user_id
                expression: 'apiKey.user_id'
            unit: Tokens
EOF
```

{{< callout type="info" >}}
This example keeps the `secretRef` authentication from the previous step. If you used `secretSelector` instead, keep your `secretSelector` block in place of `secretRef`.
{{< /callout >}}

{{< doc-test paths="virtual-keys-with-ratelimit" >}}
YAMLTest -f - <<'EOF'
- name: wait for api-key-auth policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: api-key-auth
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `apiKeyAuthentication` | The API key authentication from the previous step. Keeping it in the same policy as the rate limit avoids the silent conflict that occurs when two policies target the same Gateway. |
| `rateLimit.global` | Use global rate limiting to enforce limits across all {{< reuse "agw-docs/snippets/agentgateway.md" >}} instances. |
| `domain` | The rate limit domain. Must match the `domain` in the rate limit server configuration (`agentgateway`). |
| `backendRef` | References the rate limit server Service. Must include `kind`, `name`, `namespace`, and `port`. This example points at the `ratelimit` Service in the `ratelimit` namespace that you deploy in the next step. |
| `descriptors[].entries[].name` | The name of the descriptor entry. Must match a `key` in the rate limit server config. Set to `user_id` to rate limit per user. |
| `descriptors[].entries[].expression` | CEL expression to extract the user ID from the API key's metadata. |
| `descriptors[].unit` | Set to `Tokens` so the gateway reports each response's token count as the cost. The rate limit server subtracts that cost from the user's budget. |
