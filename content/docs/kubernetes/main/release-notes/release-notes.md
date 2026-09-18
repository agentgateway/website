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
