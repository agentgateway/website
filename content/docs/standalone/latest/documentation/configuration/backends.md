---
title: Backends
weight: 35
description: Configure backends to route traffic to hostnames, LLM providers, and MCP servers.
prev: /configuration/listeners
test:
  backends:
  - file: ${versionRoot}/configuration/backends.md
    path: backends
---

Agentgateway {{< gloss "Backend" >}}backends{{< /gloss >}} control where traffic is routed to.
Agentgateway supports a variety of backends, such as simple hostnames and IP addresses, {{< gloss "Provider" >}}LLM providers{{< /gloss >}}, and MCP servers.

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="backends" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}"
{{< /doc-test >}}

## Static Hosts

The simplest form of backend is a static hostname or IP address. Static hosts are a routing-based backend, so they are configured in a `routes` entry; the simplified `llm` and `mcp` modes model only LLM providers and MCP targets. For example:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    protocol: HTTP
routes:
- backends:
  - host: example.com:8080
    weight: 1
  - host: 127.0.0.1:80
    weight: 9
```

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The static host backend example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That traffic is actually routed/weighted to the hosts at runtime — requires
#     reachable backends the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    protocol: HTTP
routes:
- backends:
  - host: example.com:8080
    weight: 1
  - host: 127.0.0.1:80
    weight: 9
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## MCP Servers

The MCP backend allows you to connect to an MCP server.
Below shows a simple example, exposing a local and remote MCP server.
See the [MCP connectivity guide]({{< link-hextra path="/documentation/mcp/" >}}) for more information.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  targets:
  - name: stdio-server
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
  - name: http-server
    mcp:
      host: https://example.com/mcp
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      targets:
      - name: stdio-server
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
      - name: http-server
        mcp:
          host: https://example.com/mcp
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The MCP backend example (stdio + remote MCP targets) is accepted by
#     agentgateway in both the routing-based (gateways) and simplified MCP (mcp) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the MCP targets actually start/connect at runtime — requires the npx
#     command and remote server the page does not stand up.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      targets:
      - name: stdio-server
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
      - name: http-server
        mcp:
          host: https://example.com/mcp
EOF
agentgateway -f config2.yaml --validate-only

cat <<'EOF' > config2-simplified.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  targets:
  - name: stdio-server
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
  - name: http-server
    mcp:
      host: https://example.com/mcp
EOF
agentgateway -f config2-simplified.yaml --validate-only
{{< /doc-test >}}

### Session routing

By default, MCP backends use stateful session routing, where the gateway tracks session IDs and routes subsequent requests to the same upstream. For upstreams that do not maintain server-side session state, you can set `statefulMode: stateless`. In stateless mode, the gateway automatically wraps each request with an initialization sequence, so the upstream server processes every request independently.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  statefulMode: stateless
  targets:
  - name: openapi-server
    openapi:
      host: petstore3.swagger.io:443
      schema:
        url: https://petstore3.swagger.io/api/v3/openapi.json
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      statefulMode: stateless
      targets:
      - name: openapi-server
        openapi:
          host: petstore3.swagger.io:443
          schema:
            url: https://petstore3.swagger.io/api/v3/openapi.json
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The stateless session-routing MCP backend example is accepted by agentgateway
#     in both the routing-based (gateways) and simplified MCP (mcp) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That stateless wrapping actually occurs at runtime — requires the OpenAPI
#     upstream and live MCP traffic the page omits.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - mcp:
      statefulMode: stateless
      targets:
      - name: openapi-server
        openapi:
          host: petstore3.swagger.io:443
          schema:
            url: https://petstore3.swagger.io/api/v3/openapi.json
EOF
agentgateway -f config3.yaml --validate-only

cat <<'EOF' > config3-simplified.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  statefulMode: stateless
  targets:
  - name: openapi-server
    openapi:
      host: petstore3.swagger.io:443
      schema:
        url: https://petstore3.swagger.io/api/v3/openapi.json
EOF
agentgateway -f config3-simplified.yaml --validate-only
{{< /doc-test >}}

## LLM Providers

Agentgateway natively supports connecting to LLM providers, such as OpenAI and Anthropic.
Below shows a simple example, connecting to OpenAI.
See the [LLM consumption guide]({{< link-hextra path="/documentation/llm/" >}}) for more information.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: openai
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: openai
      provider:
        openAI:
          model: gpt-3.5-turbo
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The OpenAI LLM provider example is accepted by agentgateway in both the
#     routing-based (ai backend) and simplified LLM (llm.models) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually proxied to OpenAI at runtime — requires a real
#     OPENAI_API_KEY and live LLM traffic the page omits.
cat <<'EOF' > config4.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - ai:
      name: openai
      provider:
        openAI:
          model: gpt-3.5-turbo
  policies:
    backendAuth:
      key: "$OPENAI_API_KEY"
EOF
agentgateway -f config4.yaml --validate-only

cat <<'EOF' > config4-simplified.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: openai
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config4-simplified.yaml --validate-only
{{< /doc-test >}}

## AWS AgentCore

The AWS backend routes requests to an [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) agent runtime. AgentCore is a routing-based backend, so it is configured in a `routes` entry.

Agentgateway derives the connection details from the `agentRuntimeArn` value: requests are sent over TLS to the `bedrock-agentcore` endpoint in the runtime's AWS region, with the path set to the runtime's invocation endpoint. Agentgateway signs each request with AWS SigV4 by using the standard [AWS credential lookup](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) from the environment.

The following configuration is from the [`traffic-aws-agentcore` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-aws-agentcore) in the agentgateway repository.

{{% github-yaml url="https://agentgateway.dev/examples/traffic-aws-agentcore/config.yaml" %}}

| Setting | Description |
| -- | -- |
| `agentRuntimeArn` | The ARN of the AgentCore agent runtime to invoke, in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`. |
| `qualifier` | Optional runtime version or endpoint qualifier to invoke. If unset, the default endpoint is used. |
| `policies.requestHeaderModifier` | Optional headers to set before the request is sent upstream, such as the `X-Amzn-Bedrock-AgentCore-Runtime-User-Id` header that identifies the user to the AgentCore runtime. |

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The AWS AgentCore backend config from the traffic-aws-agentcore example,
#     embedded on this page, is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually signed and proxied to AgentCore at runtime —
#     requires AWS credentials and a real agent runtime the page omits.
curl -L https://agentgateway.dev/examples/traffic-aws-agentcore/config.yaml -o config5.yaml
agentgateway -f config5.yaml --validate-only
{{< /doc-test >}}

## Session affinity

When a backend resolves to more than one endpoint, agentgateway load balances across them, and two requests from the same client can land on different endpoints. Set the `sessionAffinity` backend policy to send every request that carries the same value to the same endpoint.

A `source` CEL expression selects the value. Agentgateway hashes it and maps the hash to an endpoint with weighted rendezvous hashing, so each replica picks the same endpoint for the same value without sharing any state with the other replicas.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      sessionAffinity:
        source: request.headers["x-session-id"]
```

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * `sessionAffinity.source` is accepted on a routing-based backend, which is the
#     only place it attaches. It is not a route policy: agentgateway rejects
#     `routes[].policies.sessionAffinity` as an unknown field.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That two requests with the same header reach the same endpoint -- the page
#     configures a single endpoint, and proving the mapping needs several backend
#     replicas and a way to identify which one answered.
cat <<'EOF' > config-affinity.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      sessionAffinity:
        source: request.headers["x-session-id"]
EOF
agentgateway -f config-affinity.yaml --validate-only
{{< /doc-test >}}

| Field | Required | Description |
| -- | -- | -- |
| `source` | Yes | CEL expression evaluated against the request. It must return a string or bytes value. Requests that produce the same value are sent to the same healthy endpoint. |

Common expressions for `source` include the following.

| Expression | Affinity per |
| -- | -- |
| `request.headers["x-session-id"]` | Session identifier that the client sends. |
| `string(source.address)` | Client IP address. |
| `jwt.sub` | Authenticated user, when a JWT policy runs on the same route. |

### What session affinity does not do

Session affinity is best-effort, and it is **not** session persistence. Agentgateway does not record which endpoint a value was sent to. It recomputes the mapping for each request from the value and the set of healthy endpoints, which has two consequences.

- **The mapping moves when the endpoint set changes.** Adding, removing, or losing an endpoint remaps some values, so a client can be moved to a different endpoint mid-session. Rendezvous hashing keeps that disruption small, because only the values that mapped to the changed endpoint move, but it is not zero.
- **A request that produces no usable value is not pinned.** Agentgateway falls back to normal load balancing when the expression fails to evaluate, returns a value that is not a string or bytes, or returns an empty value, such as a header the client did not send. The request still succeeds.

Do not use session affinity to hold server-side state that only one endpoint has. Use it to improve cache hit rates, to keep a conversation on one replica when that is a preference rather than a requirement, or to make debugging easier.

> [!TIP]
> A fallback is silent by design, so a misconfigured expression looks the same as working affinity from the outside. Each miss is logged at `trace` level with the expression and the reason, so run agentgateway with trace logging when affinity does not appear to take effect. For more information, see [Trace requests]({{< link-hextra path="/documentation/operations/trace-requests/" >}}).

Two other features choose an endpoint before affinity does, and they win when they apply: inference routing, and a stateful MCP session that is already pinned to an upstream. In practice they do not conflict, because they target different backends.

> [!NOTE]
> This policy is unrelated to the MCP [Session routing](#session-routing) section, which controls whether agentgateway keeps an MCP session with the upstream server. Session affinity chooses an endpoint; MCP session routing chooses how the MCP protocol session is managed.

