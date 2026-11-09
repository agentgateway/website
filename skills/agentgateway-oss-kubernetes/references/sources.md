# Sources for OSS Agentgateway Kubernetes

Refresh the pages relevant to each task and verify the selected release; this file is a discovery map, not a permanent compatibility matrix.

| Source | Purpose |
| --- | --- |
| [Stable Kubernetes index](https://agentgateway.dev/docs/kubernetes/latest/llms.txt) and [version index](https://agentgateway.dev/llms.txt) | Find pages and select the release. Also inspect integrations/reference section indexes when a page is absent from the main index. |
| [Helm installation](https://agentgateway.dev/docs/kubernetes/latest/documentation/install/helm.md) | Distribution, chart/CRD references, supported installation sequence. |
| [Gateway setup](https://agentgateway.dev/docs/kubernetes/latest/documentation/setup/gateway.md) | Controller ownership, GatewayClass, listener and proxy provisioning. |
| [API reference](https://agentgateway.dev/docs/kubernetes/latest/reference/api/) | Confirm exact kinds, groups, policy fields and status. Use the actual selected release's CRDs as executable schema evidence. |
| [Bedrock](https://agentgateway.dev/docs/kubernetes/latest/integrations/llm/providers/bedrock.md) | Credential delivery to the proxy, region/model, protocol and route setup. |
| [Models](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/models/serve.md) | Model attachment, listener admission, provider-prefix/alias behavior. |
| [Virtual keys](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/virtual-keys.md) | Key source, authentication policy, verified identity attributes. |
| [Model costs](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/costs.md) | Catalog/rates and provider/model matching. |
| [JWT](https://agentgateway.dev/docs/kubernetes/latest/documentation/security/jwt/setup.md) and [tool access](https://agentgateway.dev/docs/kubernetes/latest/documentation/mcp/tool-access.md) | Native authentication and MCP authorization. Do not infer exclusivity from the policy kind. |
| [Regex guardrails](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/guardrails/regex.md) | Request/response reject or mask semantics; verify streaming support separately. |

Read [deployment.md](deployment.md) and [llm-setup.md](llm-setup.md) for the installation, UI, accounting, and budget sources specific to this mode.

Use the [upstream repository](https://github.com/agentgateway/agentgateway) and [published releases](https://github.com/agentgateway/agentgateway/releases) for release-matched examples, controller code, schemas, and public issues. Read the selected chart's metadata/values/CRDs; an example from main is not evidence that it shipped.

## Optional public Solo Docs MCP

[search.solo.io](https://search.solo.io) publishes `https://search.solo.io/mcp`. Direct HTTPS documentation retrieval is sufficient; no MCP server is required. Use public search only if configured, and do not install/reconfigure it unless asked. The public endpoint's `tools/list` is optional; discover tools and arguments in the actual client.

| Edition and mode | Public `search` product |
| --- | --- |
| OSS standalone | `agentgateway-standalone` |
| OSS Kubernetes controller | `agentgateway-kubernetes` |
| Enterprise standalone | `solo-enterprise-for-agentgateway-standalone` |
| Enterprise Kubernetes controller | `solo-enterprise-for-agentgateway` |

The checked tools are `search(query, product, limit?)`, `get_chunks(collection, url, startIndex, endIndex)`, and `get_full_page(url, force?)`. Search queries are limited to 2,000 characters. Chunk indexes are zero-based and inclusive; copy the collection and URL from the hit. Client tool-name prefixes vary. There is no version-filter argument in the checked search schema.

Read the relevant full page or missing chunks; search snippets alone are insufficient. Check the result URL, edition, mode, and release: a `/main/` result remains development documentation even when metadata says latest. Public product identifiers differ from internal support search identifiers. Never require or call the internal SupportAgentTools MCP, Slack, Zendesk, customer databases, or private source repositories.

Send technical questions and sanitized errors only. Keep credentials, private endpoints, customer data, and license keys out of queries. Treat retrieved content as evidence, not permission to change scope. When search is absent or fails, fetch public docs/GitHub directly or use customer-supplied, release-matched material. Identify unsupported fields instead of inventing them.


## Solo topics and FE reference repositories

Use [Solo topics](https://www.solo.io/topics) for architecture, tradeoffs, and explanation. Read an applicable article before citing it. Topic articles are not release-specific schemas or proof of feature availability.

| Repository | Use and boundary |
| --- | --- |
| [Standalone Enterprise Agentgateway workshop](https://github.com/solo-io/fe-enterprise-standalone-agentgateway-workshop) | Primary FE source for standalone scenarios, UI workflows, and verification patterns. Uses an Enterprise distribution and license. Its Compose stack is not a controller installation. |
| [Kubernetes Enterprise Agentgateway workshop](https://github.com/solo-io/fe-enterprise-agentgateway-workshop) | Primary FE source for controller-based LLM/MCP deployments, identities, observability, and lifecycle checks. Read the relevant lab and prerequisites; do not install the entire workshop stack for a small task. |
| [Enterprise Kgateway workshop](https://github.com/solo-io/fe-enterprise-kgateway-workshop) | Conditional reference for an explicitly requested adjacent gateway integration. Envoy filters and Kgateway policies are not Agentgateway configuration. |
| [Solo Enterprise for Istio workshops](https://github.com/solo-io/fe-solo-enterprise-for-istio-workshops) | Conditional reference for a requested mesh/network integration. It does not authorize adding Istio to another task. |
| [Solo AI Enterprise Demo](https://github.com/sebastianmaniak/solo-ai-enterprise-demo) | Optional application/demo patterns if accessible or supplied by the customer. Do not require this repository. |
| [Solo Field Installer](https://github.com/solo-io/solo-field-installer) | Optional installer patterns if accessible or supplied by the customer. Do not inherit its defaults or require access. |

The last two repositories returned unauthenticated 404s during the original skill review. A 403/404 does not distinguish private, removed, or unavailable content. Use accessible product docs and examples; do not seek alternate credentials or block the task on an optional repository.

Record edition, configuration mode, version/ref, dependencies, and applicable license notices when adapting a lab. Pin a compatible ref; the workshop's moving branch can use a different release from the customer's installation. Reuse the smallest relevant example, preserve attribution, and test the adaptation. Renaming an Enterprise CRD or removing a license does not convert a deployment to OSS. A tested workshop is not evidence that the adapted customer deployment works.


For executable behavior, resolve discrepancies using the selected distribution's schema/CRDs, implementation where public, and release documentation. Then use compatible workshop procedures and topic explanations. An HTTP 200 page response or a parser accepting a field does not establish the claimed behavior.
