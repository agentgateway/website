---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway standalone release.
test: skip
---

Review the release notes for agentgateway standalone.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v16-highlights}

- **[Response idle timeout and simplified LLM timeouts](#v16-response-idle-timeout)**: Bound the gap between response body frames, and apply the timeout policy to the simplified `llm:` section.
- **[OpenTelemetry access log field names](#v16-access-log-preset)**: Rename the built-in HTTP fields in the stdout access log to their semantic convention equivalents.

## 🔥 Breaking changes {#v16-breaking-changes}

### `agctl catalog import` merges multiple sources and tags Bedrock models by default

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3275 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3187 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3481 -->

The `agctl catalog import` command used to accept a single pricing source. The `--source` flag now takes a comma-separated list, and the sources merge in the order that you list them, so a later source overlays an earlier one. Three sources are available: `models.dev`, `aws-bedrock-mantle`, and `github`.

| Flag | 1.5.x | 1.6.x |
| --- | --- | --- |
| `--source` value | A single source | A comma-separated list, merged in order |
| `--source` omitted | Imports `models.dev` | Imports `models.dev,aws-bedrock-mantle` |
| `--source models.dev` | Imports `models.dev` | Unchanged, but no Bedrock tags are added |
| `--source aws-bedrock-mantle` | Rejected as an unsupported source | Tags Amazon Bedrock models, and contributes no rates |
| `--source github` | Rejected as an unsupported source | Imports the curated catalog that the agentgateway project publishes at [agentgateway.dev/model-catalog](https://agentgateway.dev/model-catalog) |

Rates are unaffected by the new default, because `models.dev` is still the only source in it that prices models. The catalog file format does not change either, so a catalog that you generated earlier still loads.

The change is that a default import now writes tags onto the Amazon Bedrock models. The `aws-bedrock-mantle` source reads the AWS model cards and records which endpoint serves each model, `runtime` or `mantle`, along with the request formats that the Mantle endpoint accepts. Two of those tag groups change how a Bedrock request is routed:

- The `runtime` and `mantle` tags decide which Bedrock endpoint a chat request takes, under the new `bedrockEndpointPreference` setting on the Bedrock provider. The default, `runtimePreferred`, sends a model to Mantle only when that model is tagged `mantle` and not `runtime`.
- The chat format tags, such as `anthropic_messages` and `openai_responses`, replace the built-in list of accepted formats, but only for a model that the first rule sends to Mantle, and only when that model is not an `anthropic.claude*` model. A request in a format that is not tagged then fails with an unsupported conversion error. A model that stays on Runtime keeps accepting what it accepted in 1.5.x.

**Actions to take**: Only Mantle-served Bedrock models change behavior, so the models that concern you are the ones tagged `mantle` and not `runtime`, other than `anthropic.claude*`. If you route traffic to any of those, regenerate your catalog once by hand, list those models from the `aws.bedrock` provider in the generated file, and check their `tags` against the request formats that your clients send. To keep the 1.5.x output, pin the source with `--source models.dev`. For the flags, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference. For the endpoint setting, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).

### A `baseUrl` with no path now sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`params.baseUrl` sets the provider address and the base path that endpoint paths are appended to. A URL with no path, such as `https://api.openai.com`, used to leave the base path unset, and the upstream path then depended on the provider.

- For `custom` and the providers built on it, such as `ollama`, the endpoint path was appended to a hardcoded `/v1`, which is OpenAI's convention. A provider that serves its API somewhere else was unreachable.
- For a built-in provider such as `openai`, the path the client sent was forwarded as it arrived. A request that had to be translated from another API format kept the client's path and went somewhere the provider does not serve.

A URL with no path now has a base path of `/` in both cases, which is the rule that a URL with a path already followed.

| Configuration and client request | 1.5.x | 1.6.x |
| --- | --- | --- |
| Any provider, a URL with a path such as `https://api.openai.com/v1` | Completions go to `/v1/chat/completions` | Unchanged |
| `openai` with `https://api.openai.com`, client sends `POST /v1/chat/completions` in the OpenAI format | The client's path is forwarded as it arrived, so completions go to `/v1/chat/completions` | Completions go to `/chat/completions` |
| `openai` with `https://api.openai.com`, client sends `POST /v1/messages` in the Anthropic format | The client's path is forwarded as it arrived, so the translated request goes to `/v1/messages`, which OpenAI does not serve | Completions go to `/chat/completions` |
| `custom` or `ollama` with a URL with no path, and no `formats[].path` | Completions go to `/v1/chat/completions` | Completions go to `/chat/completions` |

The change matters most for `custom` providers and the `openai` provider.

- A `custom` provider that serves its API at the root, such as Perplexity at `https://api.perplexity.ai/chat/completions`, was unreachable before and now works. A `custom` provider that serves its API under `/v1`, such as Ollama, needs that path in the base URL, such as `http://localhost:11434/v1`.
- A base URL of `https://api.openai.com` does not reliably reach the OpenAI endpoint at `https://api.openai.com/v1` in either release. Going forward, set `params.baseUrl` to `https://api.openai.com/v1`, or omit `params.baseUrl` to use that address by default.

**Actions to take**: Review every `params.baseUrl` that you set and add the path that the provider serves its API under. OpenAI serves its API under `/v1`, so `https://api.openai.com` becomes `https://api.openai.com/v1`. A URL that already has a path is unaffected, and so is a provider that you use without a `baseUrl` override, because the built-in provider defaults already carry their own paths. A `custom` provider that sets `formats[].path` is also unaffected, because that path is sent as written and the base path is not added to it.

## 🌟 New features {#v16-new-features}

### Resiliency {#v16-features-resiliency}

#### `responseIdleTimeout` and simplified LLM timeouts {#v16-response-idle-timeout}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3310 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/3366 -->

A new `responseIdleTimeout` field bounds the gap between response body frames, rather than the total response duration. `requestTimeout` and `backendRequestTimeout` both stop measuring elapsed time after the response headers arrive, so neither one can terminate a backend that stalls mid-stream without also capping how long a legitimately long response is allowed to run. `responseIdleTimeout` restarts its window on every body frame, is disabled when the field is unset or set to zero, and never applies to responses that switch protocols, so upgraded WebSocket and CONNECT tunnels are unaffected. The timeout policy is also now available on the simplified `llm:` section, alongside the existing routing-based and simplified MCP forms.

For the field descriptions and examples, see [Route timeouts]({{< link-hextra path="/documentation/configuration/resiliency/timeouts/#route-timeouts" >}}).

### MCP {#v16-features-mcp}

#### Gateway server information overrides {#v16-mcp-server-info}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3425 -->

When agentgateway multiplexes several MCP targets, the `initialize` response carries `serverInfo` and instructions that describe the gateway itself, not any one target. A new `mcp.server` block overrides those values. Set `name` and `version` together to replace `serverInfo.name` and `serverInfo.version`, for example to avoid exposing the gateway software and version. Set `title` to report a `serverInfo.title`, and set `instructions` to add a preamble that comes before any instructions that the targets return. A backend with a single target is unaffected and keeps reporting the target server's own metadata.

The `mcp.server` block is available only in the standalone configuration file. It is not yet part of the Kubernetes API.

For the fields and an example, see [Server information overrides]({{< link-hextra path="/integrations/mcp/servers/virtual/#server-information-overrides" >}}).

### Operations {#v16-features-operations}

#### OpenTelemetry field names for stdout access logs {#v16-access-log-preset}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

The stdout access log uses short, human-oriented field names, such as `http.path`. A new `preset` field on the access log policy selects a built-in field set instead. Set `preset: otel` to rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path`, and to emit `network.protocol.version` as `1.1` rather than `HTTP/1.1`. The preset also adds `url.scheme`, and it adds `server.port` and `url.query` when the request supplies them. Note that `url.path` carries the path only: a query string that used to appear on `http.path` now appears on `url.query` instead.

Only the built-in HTTP field set is renamed. The `gen_ai.*` and `mcp.*` fields already use semantic convention names, fields that you add yourself keep the names that you give them, and an OTLP export is unaffected.

For the field rename table and an example, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

### Security {#v16-features-security}

#### Destination and TLS SNI variables in network authorization {#v16-network-authz-sni}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3540 -->

Previously, network authorization rules could match only on the source of a connection.

Now, the `destination.address`, `destination.port`, and `destination.hostname` CEL variables are available in `frontendPolicies.networkAuthorization` rules.

`destination.address` and `destination.port` are the listener address and port on agentgateway that the client connected to, not the backend that the connection is routed to.

`destination.hostname` is the Server Name Indication (SNI) hostname from the TLS handshake, so a rule such as `require: 'destination.hostname == "db.internal.example.com"'` admits only TLS connections for that hostname.

`destination.hostname` is set only on listeners with the `TLS` protocol. It is unset on HTTP and HTTPS listeners, even when the client sends SNI, and for clients that send no SNI. A `require` rule that references it rejects every such connection, so apply it only to `TLS` listeners.

For the variables and an example, see [Require TLS SNI]({{< link-hextra path="/documentation/configuration/security/network-authz/#require-tls-sni" >}}).
