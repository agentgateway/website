---
title: Install agctl
weight: 5
description: Install agctl to manage standalone resources, virtual keys, budgets, request logs, and analytics, and debug agentgateway.
test: skip
---

> [!WARNING]
> {{< reuse "agw-docs/snippets/feature-experimental.md">}}

{{< reuse "agw-docs/pages/operations/agctl-install.md" >}}

## Manage standalone agentgateway

Use a main development build of `agctl` with a main development build of agentgateway for the following commands. Until these commands are released, use the **Build from source** instructions above with the `main` branch. Confirm that `agctl standalone --help` lists them.

| Command | Use it to |
| --- | --- |
| `agctl standalone get` | List configuration resources or inspect a resource by name or ID. |
| `agctl standalone apply` | Create or update resources from YAML or JSON resource documents. |
| `agctl standalone delete` | Remove a configuration resource. |
| `agctl standalone keys` | List LLM virtual keys; use `keys create` to generate a hashed key. |
| `agctl standalone budgets` | Check per-key dollar or token budget usage. |
| `agctl standalone logs` | Query or follow LLM request logs stored in a database. |
| `agctl standalone analytics` | Summarize recorded requests, tokens, cost, and performance. |

Start with [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/" >}}) to connect the CLI and learn the resource format. Then [manage virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) or [view request logs]({{< link-hextra path="/documentation/observability/access-logs/view/#cli" >}}).

The commands work with standalone agentgateway running as a binary, in Docker, or through the standalone Helm chart. They call its configuration and observability APIs; they do not manage Kubernetes Gateway API resources. The `standalone logs` command reads stored requests, while `proxy log` controls process log levels.
