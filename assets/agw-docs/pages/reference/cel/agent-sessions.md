### Agent sessions {#agent-sessions}

CEL expressions read the detected session ID as `request.agent.session`. Detection runs before all policies, making the ID available to every request policy.

#### Session detection rules {#session-detection}

Agentgateway checks the following well-known headers in order and uses the first valid value.

1. Any `x-<vendor>-session-id` header, such as Claude Code's `x-claude-code-session-id`. The `<vendor>` part can be any name.
2. The Codex headers `session-id`, `session_id`, `thread-id`, and `conversation_id`, in that order.

   These headers require a `User-Agent` starting with `codex` followed by `-`, `_`, `/`, or a space. For example: `codex_cli_rs/0.50.0`.

3. The `x-session-id` header, such as from opencode.

Values must have at least 8 characters. Only letters, digits, hyphens (`-`), and underscores (`_`) are allowed. Agentgateway skips invalid values and checks the next header.

Examples of detected sessions:

| Request headers | `request.agent.session` |
| -- | -- |
| `x-claude-code-session-id: e96634a3-fa28-4083` and `x-session-id: opencode-1234` | `e96634a3-fa28-4083` |
| `x-session-id: opencode-1234` | `opencode-1234` |
| `User-Agent: codex_cli_rs/0.50.0` and `thread-id: 019a-thread-0001` | `019a-thread-0001` |
| `User-Agent: curl/8.7.1` and `session-id: 019a-thread-0001` | Not set, because the `User-Agent` is not Codex. |
| `x-session-id: short` | Not set, because the value has fewer than 8 characters. |

If no session is detected, `request.agent.session` is unset. Use `default(request.agent.session, "none")` to provide a fallback value.

#### Override session detection {#session-override}

If the default session detection does not fit your clients, you can override it. Set the `config.standardAttributes.session` field to a CEL expression that returns the session ID for your clients. Add the field to the [`rawConfig`]({{< link-hextra path="/documentation/setup/customize/customize/#rawconfig" >}}) of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that your Gateway uses. Agentgateway evaluates the expression for each request and uses the result as follows:

| Expression result | Agent session |
| -- | -- |
| A non-empty string | The string, as is. The length and character checks from the detection rules don't apply. |
| `null` or an empty string | None. The request has no agent session, even if it has a recognized session header. |
| Any other type, or an error | Agentgateway ignores the expression and uses the default detection from [Session detection rules](#session-detection). The result is the ID from the request headers, or no session if none match. |

An expression that reads a missing header fails with an error. To leave requests without that header unset instead of falling back to default session detection, wrap the session lookup in a `default()` function, as shown in the following example. Requests without an `x-conversation` header have no agent session, even if they have another recognized session header.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  rawConfig:
    config:
      standardAttributes:
        session: 'default(request.headers["x-conversation"], "")'
```
