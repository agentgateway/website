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

### Operations {#v16-features-operations}

#### OpenTelemetry field names for stdout access logs {#v16-access-log-preset}

<!-- ref: https://github.com/agentgateway/agentgateway/pull/3182 -->

The stdout access log uses short, human-oriented field names, such as `http.path`. A new `preset` field on the access log policy selects a built-in field set instead. Set `preset: otel` to rename the built-in HTTP fields to their [OpenTelemetry semantic convention](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) equivalents, such as `url.path`, and to emit `network.protocol.version` as `1.1` rather than `HTTP/1.1`. The preset also adds `url.scheme`, and it adds `server.port` and `url.query` when the request supplies them. Note that `url.path` carries the path only: a query string that used to appear on `http.path` now appears on `url.query` instead.

Only the built-in HTTP field set is renamed. The `gen_ai.*` and `mcp.*` fields already use semantic convention names, fields that you add yourself keep the names that you give them, and an OTLP export is unaffected.

For the field rename table and an example, see [Use OpenTelemetry field names]({{< link-hextra path="/observability/access-logs/view/#preset" >}}).
