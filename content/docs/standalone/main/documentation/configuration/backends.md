---
title: Backends
weight: 35
description: Configure backends to route traffic to hostnames, LLM providers, and MCP servers.
prev: /configuration/listeners
---

Agentgateway {{< gloss "Backend" >}}backends{{< /gloss >}} control where traffic is routed to.
Agentgateway supports a variety of backends, such as simple hostnames and IP addresses, {{< gloss "Provider" >}}LLM providers{{< /gloss >}}, and MCP servers.

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

## Static Hosts

You can add static hosts in the UI or in the configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
In the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), static hosts are part of a route. The following steps create the same `api-v2` route as the **Config file** tab. The route sends 80% of requests to `api-v2.example.com:8080` and 20% to `api-v1.example.com:8080`.

1. Open **Traffic** > **Routes**, and click **Add route**. To change an existing route instead, click the **Edit route** icon for the route.
2. Select the `default` **Gateway**, and enter `api-v2` for the **Name**. The UI requires a route name.
3. In the **Backends** section, click **Add backend** two times.
4. Enter `api-v2.example.com:8080` for the **Host** of the first backend, and `80` for its **Weight**.
5. Enter `api-v1.example.com:8080` for the **Host** of the second backend, and `20` for its **Weight**.

   {{< reuse-image src="img/ui-route-weighted-backends.png" srcDark="img/ui-route-weighted-backends-dark.png" alt="Edit route drawer for the api-v2 route with two host backends weighted 80 and 20" >}}

6. Click **Save route**.

The UI also writes `gateways: default` and a `/` path prefix match on a new route. Both values are the defaults, so the route behaves the same as the route in the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
The simplest form of backend is a static hostname or IP address. Static hosts are a routing-based backend, so they are configured in a `routes` entry; the simplified `llm` and `mcp` modes model only LLM providers and MCP targets. For example:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    protocol: HTTP
routes:
- name: api-v2
  backends:
  - host: api-v2.example.com:8080
    weight: 80
  - host: api-v1.example.com:8080
    weight: 20
```
{{% /tab %}}
{{< /tabs >}}

## Backend connection lifetime {#connection-lifetime}

Use `policies.http.maxConnectionDuration` to stop reusing a connection after a fixed age. Agentgateway opens a fresh connection for subsequent requests and lets requests already using the old connection finish. This is a connection-pool setting, separate from a request timeout.

HTTP/2 PING keepalives detect upstream connections that are no longer responsive, including idle connections. Configure their interval and acknowledgment timeout globally under `config.backend`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  backend:
    h2KeepaliveInterval: 30s
    h2KeepaliveTimeout: 5s
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: api.example.com:8080
    policies:
      http:
        version: HTTP/2.0
        maxConnectionDuration: 10m
```

| Field | Description |
| --- | --- |
| `config.backend.h2KeepaliveInterval` | Interval between PING frames on upstream HTTP/2 connections, including idle ones. Defaults to `0s`, which disables PING keepalives. Choose an interval that the upstream server permits; some gRPC servers reject frequent PINGs. |
| `config.backend.h2KeepaliveTimeout` | Time to wait for a PING acknowledgment before closing an unresponsive connection. Defaults to `5s` and applies only when PING keepalives are enabled. |
| `policies.http.version` | Use HTTP/2 for this backend. PING settings do not apply to HTTP/1 connections. |
| `policies.http.maxConnectionDuration` | Maximum age for reusing a connection for a new request. When omitted, no maximum age is configured. In-flight requests are not interrupted. |

Changes to `config.backend` require a process restart. Per-backend connection policies reload with the rest of the routing configuration.

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

## AWS AgentCore

The AWS backend routes requests to an [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) agent runtime. Configure the AWS backend inline in a `routes` entry, as in the following example, or as a named top-level `backends` entry that several routes reference.

Agentgateway derives the connection details from the `agentRuntimeArn` value: requests are sent over TLS to the `bedrock-agentcore` endpoint in the runtime's AWS region, with the path set to the runtime's invocation endpoint. Agentgateway signs each request with AWS SigV4 under the `bedrock-agentcore` signing name, by using the standard [AWS credential lookup](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) from the environment. To authenticate to a runtime that uses a JWT authorizer instead, set a `policies.backendAuth.key` policy, which replaces the SigV4 signing. For the steps to set up both modes, see [Connect to AWS Bedrock AgentCore]({{< link-hextra path="/documentation/agent/agentcore/" >}}).

The following configuration is from the [`traffic-aws-agentcore` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-aws-agentcore) in the agentgateway repository.

{{% github-yaml url="https://agentgateway.dev/examples/traffic-aws-agentcore/config.yaml" %}}

| Setting | Description |
| -- | -- |
| `agentRuntimeArn` | The ARN of the AgentCore agent runtime to invoke, in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`. |
| `qualifier` | Optional runtime version or endpoint qualifier to invoke, which is sent as a `qualifier` query parameter. Omit this setting to use the runtime's `DEFAULT` endpoint. |
| `policies.requestHeaderModifier` | Optional headers to set before the request is sent upstream, such as the `X-Amzn-Bedrock-AgentCore-Runtime-User-Id` header that identifies the user to the AgentCore runtime. |

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
