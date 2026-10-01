---
title: Static configuration
weight: 10
description: Configure static settings that are applied at startup time.
---

Most agentgateway configurations dynamically update as you make changes to the gateways, routes, policies, backends, and so on. 

However, a few configurations are statically configured at startup. These static configurations are under the `config` section.

For example, use `config.customFunctions` to define reusable CEL expressions.
Agentgateway registers these functions at startup, so you must restart the
process after changing them. For syntax and examples, see
[Custom CEL functions]({{< link-hextra path="/reference/cel/custom-functions/" >}}).

## Shutdown timing {#shutdown-drain}

Use `config.connectionMinTerminationDeadline` and
`config.connectionTerminationDeadline` to control graceful shutdown when the
process receives SIGTERM. During the minimum deadline, the gateway keeps
accepting new connections and discourages keep-alive reuse. After the minimum
deadline, the gateway closes the listener, refuses new connections, and lets
existing connections finish until all tracked connections close or the maximum
deadline passes.

```yaml
config:
  connectionMinTerminationDeadline: 10s
  connectionTerminationDeadline: 55s
```

| Field | Description |
| ----- | ----------- |
| `config.connectionMinTerminationDeadline` | Minimum time to keep accepting connections during shutdown. If this value is greater than `connectionTerminationDeadline`, the gateway uses the maximum deadline for both values. |
| `config.connectionTerminationDeadline` | Maximum total time to wait for connections to close gracefully. If omitted, the gateway derives the value from the `TERMINATION_GRACE_PERIOD_SECONDS` environment variable. If neither value is set, the gateway uses `5s`. |

## Static configuration file schema

The following table shows the `config` file schema for static configurations at startup. For the full agentgateway schema of dynamic and static configuration, see the [reference docs]({{< link-hextra path="/reference/configuration/schema/" >}}).

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.md" 
   section="Configuration File Schema"
   exclude="^\\|.(gateways|routes|tcpRoutes|ui|binds|frontendPolicies|policies|services|workloads|backends|llm|mcp|routeGroups)"
   timeout="120s"
%}}
