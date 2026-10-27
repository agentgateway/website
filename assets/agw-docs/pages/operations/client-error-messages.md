The following table lists common failures and the message that the client receives. The HTTP status code is the same as in earlier versions. Only the message is shorter.

| Failure | Response body |
| -- | -- |
| JWT, API key, basic, or OIDC authentication fails. | `authentication failed` |
| An authorization policy denies the request, or the external authorization service cannot be reached. | `authorization failed` |
| Backend authentication cannot get or use a credential. | `backend authentication failed` |
| The route has no backend, or the backend has no healthy endpoint. | `no backends available` |
| A dynamic backend resolves to a loopback or link-local address. | `backend not allowed` |
| DNS resolution for the backend fails. | `dns resolution failed` |
| The connection to the backend fails. | `connection refused`, `connection reset`, `connection aborted`, `connection timed out`, `upstream connection failed`, or `upstream call failed` |
| The request times out. | `request timeout` |
| A policy, such as a CEL expression, fails to run. | `policy failed` |
| An external processing call fails. | `external processing failed` |
| An LLM request fails with a `5xx` status code. | `failed to process LLM request` or `failed to process LLM response` |
| A budget limit is reached. | `budget exceeded`, in the `error.message` field of a JSON body |
| Another internal error occurs. | `internal error` |

Some responses keep their details or work differently.

* **LLM client errors**: An LLM request that fails with a `4xx` status code keeps its detail, because the detail describes the client's own request. For example, `failed to process LLM request: unsupported conversion: from Completions to provider custom`.
* **MCP client errors**: MCP errors that describe the client's own request also keep their detail, such as `session not found` or `client must accept both application/json and text/event-stream`. The message no longer has the `mcp:` prefix. Other MCP errors carry a generic message, such as `failed to send message` or `service unavailable`.
* **MCP authorization**: A tool, prompt, or resource that an MCP authorization rule denies returns the JSON-RPC message `unknown resource`. Clients cannot tell a denied resource from one that does not exist. This message stays the same even when you expose error details.
* **Responses from other services**: Agentgateway passes some responses through unchanged. These include a denial response from an HTTP external authorization service, a rejection response that you configure for a guardrail, a response from a remote rate limit service, and an HTTP error from an MCP server.
* **CEL `proxy.error.message`**: The `proxy.error.message` variable holds the full internal message, which is the same message as in the logs. If a transformation copies this variable onto a response, clients receive the internal detail. To tell clients the type of failure, use `proxy.error.reason` instead.
