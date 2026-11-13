Update the `api-key-auth` {{< reuse "agw-docs/snippets/policy.md" >}} from the previous step to also enforce a per-user token budget.

The policy sends a per-user token cost to the rate limit server. It extracts the `user_id` from each API key and reports the token usage of each response under that descriptor. The rate limit server holds the actual budget (100 tokens per day per user), which you deploy in the next step.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x" >}}
> [!NOTE]
> This guide uses global rate limiting so that every proxy replica draws from the same budget. If you do not need the budget to be shared across replicas, you can skip the rate limit server and set `traffic.rateLimit.local[].key` to `apiKey.user_id` instead, which gives each virtual key its own in-memory budget. For more information, see [Claim-level budget limits]({{< link-hextra path="/documentation/llm/rate-limit/#claim-level" >}}).
{{< /version >}}

```yaml
kubectl patch {{< reuse "agw-docs/snippets/policy.md" >}} api-key-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type=merge --patch-file=/dev/stdin <<'EOF'
spec:
  traffic:
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

The merge patch adds the rate limit and keeps the authentication, model restrictions, and metrics settings that the policy already has.

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting     | Description |
|-------------|-------------|
| `rateLimit.global` | Use global rate limiting to enforce limits across all {{< reuse "agw-docs/snippets/agentgateway.md" >}} instances. |
| `domain` | The rate limit domain. Must match the `domain` in the rate limit server configuration (`agentgateway`). |
| `backendRef` | References the rate limit server Service. Must include `kind`, `name`, `namespace`, and `port`. This example points at the `ratelimit` Service in the `ratelimit` namespace that you deploy in the next step. |
| `descriptors[].entries[].name` | The name of the descriptor entry. Must match a `key` in the rate limit server config. Set to `user_id` to rate limit per user. |
| `descriptors[].entries[].expression` | CEL expression to extract the user ID from the API key's metadata. |
| `descriptors[].unit` | Set to `Tokens` so the gateway reports each response's token count as the cost. The rate limit server subtracts that cost from the user's budget. |
