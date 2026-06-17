---
title: Release notes
weight: 20
description: Review the release notes for agentgateway standalone.
test: skip
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 1.3 standalone highlights {#v13-standalone-highlights}

- Standalone LLM docs now cover virtual models, including weighted, failover, and conditional routing plus public and internal model visibility.
- Reusable named providers are documented alongside model-level provider references and override behavior.
- Model cost catalogs now cover `config.modelCatalog`, `MODEL_CATALOG_PATHS`, `agctl costs import`, and CEL cost variables.
- Provider docs now use `llm.models[].auth` and the `tls` field for upstream transport settings.
- Guardrails, authorization, permissive API key mode, listener TLS, listener CORS, and shared MCP/LLM ports are documented for standalone LLM deployments.

## 🔥 Breaking changes {#v13-breaking-changes}

### `agctl` commands reorganized under `proxy` and `controller`

The experimental `agctl` CLI now groups its inspection and tracing commands under the `proxy` parent command, and adds new commands for log-level management and version information. Update any scripts or automation that call the previous top-level commands.

Before:

```sh
agctl config all --file /tmp/agw-dump.json -o yaml
agctl trace --local --port 3000 -- http://example.com/headers
```

Now:

```sh
agctl proxy config all --file /tmp/agw-dump.json -o yaml
agctl proxy trace --local --port 3000 -- http://example.com/headers
```

The reorganization also introduces the following new capabilities:

- `agctl version` prints version information for the `agctl` CLI.
- `agctl proxy log` and `agctl controller log` get or set log levels at runtime for agentgateway running in Kubernetes.

For more information, see [Install `agctl`]({{< link-hextra path="/operations/agctl/" >}}), [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}), [Trace requests with `agctl`]({{< link-hextra path="/operations/trace-requests/" >}}), and the [`agctl` CLI reference]({{< link-hextra path="/reference/agctl/" >}}).
