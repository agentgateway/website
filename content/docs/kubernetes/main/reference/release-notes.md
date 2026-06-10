---
title: Release notes
weight: 20
description: Review the release notes for agentgateway.
test: skip
---

Review the release notes for agentgateway.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🔥 Breaking changes {#v13-breaking-changes}

### `agctl` commands reorganized under `proxy` and `controller`

The experimental `agctl` CLI now groups its inspection and management commands under the `proxy` and `controller` parent commands, and adds new commands for log-level management and version information. Update any scripts or automation that call the previous top-level commands.

Before:

```sh
agctl config all gateway/agentgateway-proxy -n agentgateway-system -o yaml
agctl config backends gateway/agentgateway-proxy -n agentgateway-system
agctl trace gateway/agentgateway-proxy -n agentgateway-system --port 80 -- http://www.example.com/
```

Now:

```sh
agctl proxy config all gateway/agentgateway-proxy -n agentgateway-system -o yaml
agctl proxy config backends gateway/agentgateway-proxy -n agentgateway-system
agctl proxy trace gateway/agentgateway-proxy -n agentgateway-system --port 80 -- http://www.example.com/
```

The reorganization also introduces the following new capabilities:

- `agctl proxy log` gets or sets the proxy log level at runtime. For more information, see [Debug your setup]({{< link-hextra path="/operations/debug/#debug-logs" >}}).
- `agctl controller log` gets or sets the agentgateway controller log level per component at runtime. For more information, see [Debug your setup]({{< link-hextra path="/operations/debug/#debug-logs" >}}).
- `agctl version` prints version information for the `agctl` CLI.

For more information, see [Install agctl]({{< link-hextra path="/operations/agctl/" >}}), [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}), [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests/" >}}), and the [agctl CLI reference]({{< link-hextra path="/reference/agctl/" >}}).
