---
title: Release notes
weight: 20
description: What's new, changed, and fixed in each agentgateway on Kubernetes release.
test: skip
---

Review the release notes for agentgateway on Kubernetes.

> [!NOTE]
> For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases).

## ✨ Highlights {#v16-highlights}

Version 1.6 brings the session affinity and access log field sets of the proxy to the Kubernetes API.

- **[Session affinity](#v16-session-affinity)**: Send the requests that share a value, such as a session header, to the same endpoint.
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

- The `runtime` and `mantle` tags decide which Bedrock endpoint a chat request takes, under the new `endpointPreference` setting on the Bedrock provider. The default, `RuntimePreferred`, sends a model to Mantle only when that model is tagged `mantle` and not `runtime`.
- The chat format tags, such as `anthropic_messages` and `openai_responses`, replace the built-in list of accepted formats, but only for a model that the first rule sends to Mantle, and only when that model is not an `anthropic.claude*` model. A request in a format that is not tagged then fails with an unsupported conversion error. A model that stays on Runtime keeps accepting what it accepted in 1.5.x.

**Actions to take**: Only Mantle-served Bedrock models change behavior, so the models that concern you are the ones tagged `mantle` and not `runtime`, other than `anthropic.claude*`. If you route traffic to any of those, regenerate your catalog once by hand, list those models from the `aws.bedrock` provider in the generated file, and check their `tags` against the request formats that your clients send. To keep the 1.5.x output, pin the source with `--source models.dev`. For the flags, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference. For the endpoint setting, see [Bedrock Mantle]({{< link-hextra path="/integrations/llm/providers/bedrock/#bedrock-mantle" >}}).

### A `baseURL` with no path now sets the base path to `/` {#v16-baseurl-base-path}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3403 -->

`spec.baseURL` on an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} sets the provider address and the base path that endpoint paths are appended to. A URL with no path, such as `https://api.openai.com`, used to leave the base path unset, and the upstream path then depended on the provider. For a built-in provider such as `OpenAI`, the path the client sent was forwarded as it arrived. For `Custom` and `Ollama`, the endpoint path was appended to a hardcoded `/v1`. A URL with no path now has a base path of `/` in both cases, which is the rule that a URL with a path already followed.

| Configuration and client request | 1.5.x | 1.6.x |
| --- | --- | --- |
| Any provider, a URL with a path such as `https://api.openai.com/v1` | Completions go to `/v1/chat/completions` | Unchanged |
| `OpenAI` with `https://api.openai.com`, client sends `POST /v1/chat/completions` in the OpenAI format | The client's path is forwarded as it arrived, so completions go to `/v1/chat/completions` | Completions go to `/chat/completions` |
| `OpenAI` with `https://api.openai.com`, client sends `POST /v1/messages` in the Anthropic format | The client's path is forwarded as it arrived, so the translated request goes to `/v1/messages`, which OpenAI does not serve | Completions go to `/chat/completions` |
| `Custom` or `Ollama` with a URL with no path, and no `spec.custom.formats[].path` | Completions go to `/v1/chat/completions` | Completions go to `/chat/completions` |

The change matters most for the `OpenAI` provider. A base URL of `https://api.openai.com` does not reliably reach the OpenAI endpoint at `https://api.openai.com/v1` in either release. Going forward, set `spec.baseURL` to `https://api.openai.com/v1`, or omit `spec.baseURL` to use that address by default.

**Actions to take**: Review every `spec.baseURL` that you set and add the path that the provider serves its API under. OpenAI serves its API under `/v1`, so `https://api.openai.com` becomes `https://api.openai.com/v1`. Check your `Ollama` models first, because `Ollama` requires `spec.baseURL` and also serves its OpenAI-compatible API under `/v1`, so an in-cluster address such as `http://ollama.default.svc.cluster.local:11434` becomes `http://ollama.default.svc.cluster.local:11434/v1`. A URL that already has a path, such as an in-cluster mock at `http://httpbun.default.svc.cluster.local:3090/llm`, is unaffected. For the field, see [Providers]({{< link-hextra path="/documentation/llm/models/about/#providers" >}}).

## 🌟 New features {#v16-new-features}

### Traffic management {#v16-features-traffic}

#### Session affinity {#v16-session-affinity}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3268 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2779 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2825 -->

The `sessionAffinity` backend policy is now part of the Kubernetes API. Set it in `spec.policies` on an {{< reuse "agw-docs/snippets/backend.md" >}}, or in `spec.backend` on an {{< reuse "agw-docs/snippets/policy.md" >}}. A `source` CEL expression selects an affinity value, which agentgateway hashes and maps to an endpoint by weighted rendezvous hashing, so every proxy replica independently picks the same endpoint without sharing state.

Affinity is best-effort rather than session persistence. Agentgateway recomputes the mapping for each request, so a change to the set of healthy endpoints remaps some values, and a request that produces no usable value falls back to normal load balancing. On an AI backend, the policy applies across the provider groups of the backend and must target the whole backend rather than an individual provider.

For the fields, the fallback behavior, common expressions, and examples, see [Session affinity]({{< link-hextra path="/documentation/traffic-management/load-balancing/#session-affinity" >}}).

### Operations {#v16-features-operations}

#### OpenTelemetry field names for stdout access logs {#v16-access-log-preset}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

The stdout access log uses short, human-oriented field names, such as `http.path`. A new `preset` field on the frontend access log policy selects a built-in field set instead. Set `preset: Otel` to rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path`, and to emit `network.protocol.version` as `1.1` rather than `HTTP/1.1`. The preset also adds `url.scheme`, and it adds `server.port` and `url.query` when the request supplies them. Note that `url.path` carries the path only: a query string that used to appear on `http.path` now appears on `url.query` instead.

Only the built-in HTTP field set is renamed. Fields that you add with the `attributes` field keep the names that you give them, and an OTLP export is unaffected, because it already uses semantic convention attribute names.

For the field rename table and an example, see [Use OpenTelemetry field names]({{< link-hextra path="/documentation/observability/access-logs/view/#preset" >}}).

### Security {#v16-features-security}

#### Destination and TLS SNI variables in network authorization {#v16-network-authz-sni}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3540 -->

Previously, network authorization expressions could match only on the source of a connection.

Now, the `destination.address`, `destination.port`, and `destination.hostname` CEL variables are available in `spec.frontend.networkAuthorization` expressions on an {{< reuse "agw-docs/snippets/policy.md" >}}.

`destination.address` and `destination.port` are the listener address and port on agentgateway that the client connected to, not the backend that the connection is routed to.

`destination.hostname` is the Server Name Indication (SNI) hostname from the TLS handshake, so an expression such as `destination.hostname == 'db.internal.example.com'` with `action: Require` admits only TLS connections for that hostname.

`destination.hostname` is set only on Gateway listeners with `protocol: TLS`. It is unset on HTTP and HTTPS listeners, even when the client sends SNI, and for clients that send no SNI. A `Require` policy that references it denies every such connection, so apply it only to Gateways whose listeners use `protocol: TLS`.

For an example, see [Restrict network access by TLS SNI]({{< link-hextra path="/documentation/security/authorization/#restrict-network-access-by-tls-sni" >}}).

#### Backend authentication and guardrail controls {#v16-backend-auth-guardrail-controls}

Backend TLS CA certificate references can now set `key` to read a CA bundle from a Secret or ConfigMap key other than `ca.crt`. Omitting the field still reads `ca.crt`.

AWS backend authentication can now set `assumeRole.externalId` when an AWS Security Token Service (STS) AssumeRole trust policy requires `sts:ExternalId`. The value is validated against the STS length and character limits and is part of the assumed-credential cache key.

Cloud provider guardrails can now set `failureMode` to choose whether provider errors fail open or closed. These guardrails now fail closed by default instead of allowing traffic on provider errors.
