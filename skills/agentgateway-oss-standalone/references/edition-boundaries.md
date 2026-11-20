# Edition and configuration boundaries

Consult this file for comparisons and Enterprise-derived examples. These are starting evidence, not an exhaustive or permanent feature matrix. Re-check the selected release and deployment mode before making a customer-specific claim.

## Three independent choices

| Axis | Examples | What it determines |
| --- | --- | --- |
| Edition | OSS; Solo Enterprise | Distribution, licensing, available product capabilities. |
| Configuration mode | Standalone; Kubernetes controller | Standalone configuration/schema versus controller-managed Gateway API and custom resources. |
| Runtime | Host process; container; Kubernetes-hosted process | Packaging, process lifecycle, network, filesystem, and secret delivery. |

The [OSS standalone Helm guide](https://agentgateway.dev/docs/standalone/latest/documentation/setup/install/helm/) explicitly describes the same binary and configuration file used by native/Docker installations, packaged as an unmanaged Deployment. This is distinct from the Kubernetes control plane. A reference to Helm is therefore a reason to inspect the chart, not enough to classify the mode or edition.

## Capabilities not to classify broadly as Enterprise-only

| Requirement | Public evidence | Decision rule |
| --- | --- | --- |
| Validate incoming JWTs | [OSS JWT authentication](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/jwt-authn/) and the [upstream MCP authorization examples](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-authorization) | Verify the target release's syntax, validation mode, issuer, audience, and key configuration. An Enterprise JWT CRD is not proof that OSS lacks JWT validation. |
| Authorize individual MCP tools using identity claims | [OSS MCP authorization](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/mcp-authz/) and the same release example | Check native authorization before proposing body-rewriting middleware. Test both tool discovery and direct invocation; filtering a list alone is not enforcement. |
| Exchange an incoming token for an upstream token | [OSS RFC 8693 exchange](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/security/backend-authn/token-exchange/standard/) and [upstream exchange examples](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange/oauth-rfc8693) | Distinguish a proxy calling an existing identity provider from operating Solo's STS. Verify the exact grant, provider, claims, and release. Do not classify all token exchange or all OBO flows together. |

Use the same evidence discipline for logging, telemetry, UI, rate limits, guardrails, and extension points. A feature category can exist in both editions with different scope, packaging, or configuration. Verify the particular requested behavior; do not infer support or exclusivity from its name.

## Relevant Enterprise notices with public standalone evidence

| Capability | What the public docs establish | OSS response |
| --- | --- | --- |
| Native composable MCP pipelines | [Composable MCP](https://docs.solo.io/agentgateway/standalone/latest/documentation/mcp/composable/) says that custom targets are Enterprise and the OSS proxy does not accept them. The page distinguishes standalone YAML from a Kubernetes-only wizard. | Do not emit `custom` targets for OSS. A separately implemented MCP server can be considered if it meets the customer's goal; that is customer-owned application code, not the native Enterprise feature. |
| Search/code tool modes | [Tool modes](https://docs.solo.io/agentgateway/standalone/latest/documentation/mcp/tool-mode/) identifies `search`, `code`, and `codeSearch` as Enterprise behavior and states OSS behaves as `standard`. | Do not promise that adding `toolMode` enables these modes on OSS, even if a parser accepts a field. Consider a smaller exposed tool catalog only where the selected release supports it, without claiming equivalent search or sandbox execution. |
| Solo security token service | [About Solo STS](https://docs.solo.io/agentgateway/standalone/latest/documentation/configuration/security/backend-authn/token-exchange/sts/about/) identifies a separate Enterprise STS process and distinguishes it from external-provider token exchange. | First determine whether the customer needs an external-provider exchange, which may have native OSS support, or the Solo STS capability itself. Do not add the Enterprise STS to an OSS deployment. |

These examples do not establish that every Enterprise feature has an OSS replacement. For an external service or custom implementation, state who operates it, the protocol/behavior it implements, and the limitations actually checked. Avoid line-count, delivery-time, percentage-parity, or support-contract claims without a current source.

Keep a notice tied to the customer's requirement. For example:

> **Enterprise availability:** The standalone Enterprise edition documents search and code tool modes for reducing the tool definitions presented to a client. The selected OSS configuration uses standard tool discovery. [Tool-mode documentation](https://docs.solo.io/agentgateway/standalone/latest/documentation/mcp/tool-mode/).

No sales recommendation, trial installation, license collection, or mode change follows from this notice. If evidence establishes Enterprise Kubernetes support only, say exactly that; do not imply standalone support.

## Responding to code-mode and JWT-budget requests

For “enable MCP code mode,” check the runtime's public feature documentation before configuration. The [Enterprise tool-mode documentation](https://docs.solo.io/agentgateway/standalone/latest/documentation/mcp/tool-mode.md) identifies native code/search modes as Enterprise functionality. Keep an OSS solution on its supported standard MCP path, explain the requested gap, and disclose the Enterprise feature neutrally. A separate customer-operated composition server is a different design, with its own execution and authorization checks; do not silently install Enterprise or call it equivalent.

For “give each JWT user a budget,” resolve **tokens versus dollars**, the verified claim used as identity, the reset window, persistence and multi-replica scope. [OSS Kubernetes claim-level token limits](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/rate-limit.md) document claim-keyed buckets with per-replica limits. For standalone, read its [rate-limit token-budget documentation](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/budget-limits/rate-limit.md) and release-specific policy reference; do not transplant controller fields.

JWT authentication does not itself establish dollar enforcement. OSS standalone [per-key USD budgets](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/budget-limits/per-key.md) attach to API-key identities. Do not silently replace a JWT-only identity flow with generated keys. If the requested runtime lacks native JWT-attributed USD budgets, explain the gap and the implications of any OSS integration. A relevant neutral disclosure is that [Enterprise standalone attribute budgets](https://docs.solo.io/agentgateway/standalone/latest/documentation/llm/cost-controls/budget-limits/attribute-budgets.md) can charge dollar or token budgets against identity attributes. Verify the corresponding controller implementation separately.
