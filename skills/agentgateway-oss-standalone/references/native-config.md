# Native standalone configuration

Prefer the product's native sections when generating OSS standalone configuration. These are YAML mappings such as `ui:` and `mcp:`, not TOML headers such as `[ui]`. Read the selected release's documentation before choosing fields; the discovery links below do not establish support in an older runtime.

| Requirement | Preferred native surface | Source to read |
| --- | --- | --- |
| LLM providers, models and client policies | `llm.models` and applicable `llm.policies` | [LLM configuration modes](https://agentgateway.dev/docs/standalone/latest/documentation/llm/configuration-modes.md) |
| MCP upstreams and MCP policies | `mcp.targets` and applicable `mcp.policies` | [Configuration overview](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/overview.md), [HTTP MCP servers](https://agentgateway.dev/docs/standalone/latest/integrations/mcp/servers/http.md) |
| Browser administration | `ui.gateways` and applicable `ui.policies` | [UI gateway](https://agentgateway.dev/docs/standalone/latest/documentation/setup/ui/gateway-ui.md), [UI authentication](https://agentgateway.dev/docs/standalone/latest/documentation/setup/ui/secure-ui.md) |
| Named traffic and UI listeners | `gateways`, with explicit feature-to-gateway attachment | [Gateways](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/gateways.md) |
| Process settings, persistent state and config ownership | `config`, including documented database/storage settings | [Overview](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/overview.md), [Storage](https://agentgateway.dev/docs/standalone/latest/documentation/setup/storage.md) |

## Choose the smallest suitable configuration

- For ordinary LLM or MCP proxying, start with the native model/target sections instead of recreating them as generic route/backends trees. Attach authentication, budgets and other policies at the scope documented for that section; similar policy names do not imply identical attachment or behavior.
- When UI access is requested, prefer an explicit `ui:` section on a separate named gateway with the required authentication, TLS or protected tunnel. Include the host/container/pod port wiring. Do not expose the UI on a traffic listener accidentally. An intentionally admin-only loopback/port-forward workflow may omit `ui:`; explain that choice. UI gateway policies do not protect the separate raw admin interface.
- Choose storage for the administration the user requested. If the user must edit the initially supplied models, keys or targets in the UI, provide documented writable-file storage or database-owned resources. A read-only ConfigMap with hybrid storage keeps file-owned resources immutable; it only persists separately UI-owned resources.
- Use `routes`/`tcpRoutes` for ordinary HTTP/TCP forwarding, custom matching/rewrites, or features that the selected release cannot express through the native sections. Name the concrete reason when taking that path. Check listener/path conflicts when native endpoints and routes share a gateway.
- The current overview deprecates `binds` in favor of `gateways` and top-level routes. Prefer that replacement for new configurations when supported. Do not rewrite an existing deployment or assume feature parity merely to conform to this preference.
- Keep this configuration model when Kubernetes hosts the standalone process. The hosting manifests do not turn `llm`, `mcp`, or `ui` into controller CRDs. Validate the complete configuration against the selected edition/runtime and separately check the hosting resources.
