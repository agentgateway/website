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

### `agctl catalog import` reads from the `github` source by default

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3275 -->

The `agctl catalog import` command used to accept only one pricing source, `models.dev`, which was also its default. The command now accepts a second source, `github`, and defaults to it. The `github` source is the curated model catalog that the agentgateway project publishes at [agentgateway.dev/model-catalog](https://agentgateway.dev/model-catalog).

| Flag | 1.5.x | 1.6.x |
| --- | --- | --- |
| `--source` omitted | Imports from `models.dev` | Imports from `github` |
| `--source models.dev` | Imports from `models.dev` | Unchanged |
| `--source github` | Rejected as an unsupported source | Imports from `agentgateway.dev/model-catalog` |

The catalog file format does not change, so a catalog that you generated earlier still loads. The two sources can price a model differently, and the `github` source covers the models that the agentgateway project tracks rather than everything that models.dev lists.

The two sources also name some providers differently, and they disagree about what to do with an ID that they do not recognize. A `--providers` list that was written for models.dev can therefore go quiet rather than fail.

| Behavior | `models.dev` | `github` |
| --- | --- | --- |
| Provider ID namespace | models.dev IDs, such as `google` and `amazon-bedrock` | agentgateway IDs, such as `gcp.gemini` and `aws.bedrock` |
| Unrecognized `--providers` ID | Fails with `no providers matched` | Reports `imported 0 providers` and writes the catalog without it |

**Actions to take**: If you regenerate your catalog on a schedule and you want to keep importing from models.dev, add `--source models.dev` to the command. Otherwise, regenerate the catalog and compare the rates for the models that you care about before you load the new file, because a rate change alters the costs that appear in logs, traces, metrics, and any CEL policy that reads `llm.cost`. For the flags, see the [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}) reference.

## 🌟 New features {#v16-new-features}

### Traffic management {#v16-features-traffic}

#### Session affinity {#v16-session-affinity}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3268 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2779 -->
<!-- ref: https://github.com/agentgateway/agentgateway/pull/2825 -->

The `sessionAffinity` backend policy is now part of the Kubernetes API. Set it in `spec.policies` on an {{< reuse "agw-docs/snippets/backend.md" >}}, or in `spec.backend` on an {{< reuse "agw-docs/snippets/policy.md" >}}. A `source` CEL expression selects an affinity value, which agentgateway hashes and maps to an endpoint by weighted rendezvous hashing, so every proxy replica independently picks the same endpoint without sharing state.

Affinity is best-effort rather than session persistence. Agentgateway recomputes the mapping for each request, so a change to the set of healthy endpoints remaps some values, and a request that produces no usable value falls back to normal load balancing. On an AI backend, the policy applies across the provider groups of the backend and must target the whole backend rather than an individual provider.

For the fields, the fallback behavior, common expressions, and examples, see [Session affinity]({{< link-hextra path="/traffic-management/load-balancing/#session-affinity" >}}).

### Operations {#v16-features-operations}

#### OpenTelemetry field names for stdout access logs {#v16-access-log-preset}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

The stdout access log uses short, human-oriented field names, such as `http.path`. A new `preset` field on the frontend access log policy selects a built-in field set instead. Set `preset: Otel` to rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path`, and to emit `network.protocol.version` as `1.1` rather than `HTTP/1.1`. The preset also adds `url.scheme`, and it adds `server.port` and `url.query` when the request supplies them. Note that `url.path` carries the path only: a query string that used to appear on `http.path` now appears on `url.query` instead.

Only the built-in HTTP field set is renamed. Fields that you add with the `attributes` field keep the names that you give them, and an OTLP export is unaffected, because it already uses semantic convention attribute names.

For the field rename table and an example, see [Use OpenTelemetry field names]({{< link-hextra path="/observability/access-logs/view/#preset" >}}).
