---
title: Release notes
weight: 20
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🔥 Breaking changes {#v10-breaking-changes}

### New release version pattern

The previous release version pattern was changed to align the version number pattern for agentgateway standalone and agentgateway on Kubernetes. Going forward, both projects use the same release version number. If you have existing CI/CD workflows that depend on the old pattern, update them.

### CEL 2.0

This release includes a major refactor to the CEL implementation in agentgateway that brings substantial performance improvements and enhanced functionality. Individual CEL expressions are now 5-500x faster, which has improved end-to-end proxy performance by 50%+ in some tests. For more details on the performance improvements, see this [blog post on CEL optimization](https://blog.howardjohn.info/posts/cel-fast/).

The following user-facing changes were introduced:

* **Function name changes**: For compatibility with the CEL-Go implementation, the `base64Encode` and `base64Decode` functions now use dot notation: `base64.encode` and `base64.decode`. The old camel case names remain in place for backwards compatibility.
* **New string functions**: The following string manipulation functions were added to the CEL library: `startsWith`, `endsWith`, `stripPrefix`, and `stripSuffix`. These functions align with the Google [CEL-Go strings extension](https://pkg.go.dev/github.com/google/cel-go/ext#Strings).
* **Null values fail**: If a top-level variable returns a null value, the CEL expression now fails. Previously, null values always returned true. For example, the `has(jwt)` expression was previously successful if the JWT was missing or could not be found. Now, this expression fails.
* **Logical operators**: Logical `||` and `&&` operators now handle evaluation errors gracefully instead of propagating them. For example, `a || b` returns `true` if `a` is true even if `b` errors. Previously, the CEL expression failed.

Make sure to update and verify any existing CEL expressions that you use in your environment.

For more information, see the [CEL expression]({{< link-hextra path="/reference/cel/" >}}) reference.

### External auth fail-closed

External auth policies now fail closed by default when the auth server is unreachable. This means requests are denied if the external authorization service cannot be reached. You are affected if you have an `extAuthz` policy configured and the auth service becomes unavailable.

_Before_: If the external auth service was unreachable, the behavior was undefined and requests could pass through.

_After_: Requests protected by an external auth policy are rejected with a failure response until the auth service is reachable.

To explicitly allow requests when the auth service is unavailable, set the `failureMode` to `allow`:

```yaml
extAuthz:
  host: localhost:9000
  failureMode: allow
  protocol:
    grpc: {}
```

For more information, see [External authorization]({{< link-hextra path="/configuration/security/external-authz/" >}}).

### MCP deny-only authorization policies

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1058 -->

A critical correctness bug was fixed in MCP authorization. You are affected if you have an MCP authorization policy that uses deny rules without any corresponding allow rules.

For example, review the following configuration. Previously, this policy denied all tool access, not just access to the `echo` tool. Starting in 1.0.0, only `echo` is denied and all other tools are allowed.

```yaml
mcpAuthorization:
  rules:
  - deny: 'mcp.tool.name == "echo"'
```

### MCP authentication mode change

The default MCP authentication mode now defaults to `strict` mode instead of `permissive`. Requests to MCP backends without valid credentials are rejected by default. To restore the `permissive` behavior, set the `mode` field in your MCP authentication configuration:

```yaml
mcpAuthentication:
  mode: permissive
  issuer: http://localhost:9000
  jwks:
    url: http://localhost:9000/.well-known/jwks.json
```

For more information, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn/" >}}).

## 🌟 New features {#v10-new-features}

The following features were introduced in 1.0.0.

### Simplified LLM configuration

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1007 -->

A new top-level `llm` configuration section provides a simplified way to configure LLM providers. Instead of setting up the full `binds`, `listeners`, `routes`, and `backends` hierarchy, you can now define models directly in a flat structure. The simplified format defaults to port 4000.

The following example configures an OpenAI provider with a wildcard model match:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. When a client sends `"model": "<name>"`, the request is routed to this provider. Use `*` to match any model name. |
| `provider` | The LLM provider to use, such as `openAI`, `anthropic`, `bedrock`, `gemini`, or `vertex`. |
| `params.model` | The model name sent to the upstream provider. If set, this overrides the model from the request. If not set, the model from the request is passed through. |
| `params.apiKey` | The API key for authentication. You can reference environment variables using the `$VAR_NAME` syntax. |

You can also define model aliases to decouple client-facing model names from provider-specific identifiers:

```yaml
llm:
  models:
  - name: fast
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: smart
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
```

Policies such as rate limiting and authentication can be set at the `llm` level to apply to all models:

```yaml
llm:
  policies:
    localRateLimit:
    - maxTokens: 10
      tokensPerFill: 1
      fillInterval: 60s
      type: tokens
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

The traditional route-based configuration (`binds`/`listeners`/`routes`) remains fully supported for advanced use cases that require path-based routing or custom endpoints.

For more information, see the provider setup guides such as [OpenAI]({{< link-hextra path="/llm/providers/openai/" >}}), [Anthropic]({{< link-hextra path="/llm/providers/anthropic/" >}}), and [Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}).

### LLM request transformations

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1041 -->

You can now use CEL expressions to dynamically compute and set fields in LLM requests. This allows you to enforce policies, such as capping token usage, without changing client code.

The following example caps `max_tokens` to 10 for all requests:

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
       - ai:
          name: openai
          provider:
            openAI:
              model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
        ai:
          transformations:
            max_tokens: "min(llmRequest.max_tokens, 10)"
```

For more information, see [Transform requests]({{< link-hextra path="/llm/transformations/" >}}).

### Extended thinking and structured outputs for Claude providers

Extended thinking and structured outputs are now supported for Anthropic and Amazon Bedrock Claude providers.

**Extended thinking** lets Claude reason through complex problems before generating a response. Thinking is opt-in. You must provide specific attributes in your request to enable extended thinking.

**Structured outputs** constrain the model to respond with a specific JSON schema. You define the JSON schema as part of your request.

For more information, see the following resources:
* [Anthropic extended thinking and structured outputs]({{< link-hextra path="/llm/providers/anthropic/" >}})
* [Bedrock extended thinking and structured outputs]({{< link-hextra path="/llm/providers/bedrock/" >}})

### Remote URL support for OpenAPI schemas

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1060 -->

You can now load an OpenAPI schema from a remote URL by setting the `url` field in the `schema` section of your OpenAPI target configuration. Agentgateway fetches the schema at startup. Previously, only local file paths and inline schemas were supported.

```yaml
openapi:
  schema:
    url: https://example.com/api/openapi.json
  host: example.com
```

For more information, see [Connect to an OpenAPI server]({{< link-hextra path="/mcp/connect/openapi/" >}}).

### Remote rate limit failure modes

<!-- ref: https://github.com/agentgateway/agentgateway/pull/935 -->

You can now configure how agentgateway behaves when the remote rate limit service is unavailable using the new `failureMode` field. The default behavior is `failClosed`, which denies requests with a `500` status code. Set `failureMode` to `failOpen` to allow requests through when the service is unreachable.

```yaml
remoteRateLimit:
  host: localhost:9090
  domain: example.com
  failureMode: failOpen
  descriptors:
  - entries:
    - key: organization
      value: 'request.headers["x-organization"]'
    type: requests
```

For more information, see [Failure behavior]({{< link-hextra path="/configuration/resiliency/rate-limits/#failure-behavior" >}}).

### JWT claim validation for MCP auth

<!-- ref: https://github.com/agentgateway/agentgateway/pull/897 -->

You can now customize which JWT claims must be present in a token before it is accepted, using the new `jwtValidationOptions.requiredClaims` field in your MCP authentication configuration.

```yaml
mcpAuthentication:
  issuer: http://localhost:9000
  jwks:
    url: http://localhost:9000/.well-known/jwks.json
  jwtValidationOptions:
    requiredClaims:
      - exp
      - aud
      - sub
```

For more information, see [JWT claim validation]({{< link-hextra path="/configuration/security/mcp-authn/#jwt-claim-validation" >}}).

## 🪲 Bug fixes {#v10-bug-fixes}

### MCP per-request policy evaluation

MCP policies are now re-evaluated on each request rather than only at session start. If an operator updates an authorization policy, such as by revoking access to a tool or changing JWT claim requirements, the change takes effect immediately on the next request, without requiring the client to tear down and re-establish the MCP session.

Note that this is a behavioral improvement. Existing MCP authorization configuration benefits automatically.

### CORS evaluation ordering

CORS evaluation now runs *before* authentication and *before* rate limiting. Previously, CORS ran after auth and rate limiting, which caused two problems:
  - Browser preflight OPTIONS requests were rejected by auth, making cross-origin requests impossible when auth was enabled
  - Rate-limited 429 responses lacked CORS headers, so browsers saw an opaque CORS error instead of a retryable one

Note that this is a behavioral improvement. Existing configurations that combine CORS policies with extauth and rate limiting policies now work correctly.
