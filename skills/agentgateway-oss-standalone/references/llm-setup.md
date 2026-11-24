# LLM setup: providers, identities, budgets, and UI

Use this workflow for a standalone gateway on the customer's selected reachable host, VM, server, or container environment. A laptop is one possible host. Resolve the deployment target, execution access, and the network from which clients and the browser will connect; standalone describes the configuration model, not the physical location. Keep the existing runtime unless a change is requested.

## Example requests

```text
/agentgateway-oss-standalone Configure standalone agentgateway on my reachable server for OpenAI. Use my selected model and existing secret source. Verify a request and return the reachable API and protected UI access details.
```

```text
/agentgateway-oss-standalone Configure Gemini through Vertex AI in my existing container environment. Confirm the Google Cloud project, region, model and workload identity, verify a request, and show the API and UI access path.
```

```text
/agentgateway-oss-standalone Connect my Bedrock models from the selected gateway host. Give five agents independent API keys with $10 each per agreed budget window. Verify routing, identities, budget accounting and the reachable UI.
```

These are example tasks, not default providers or permission to create infrastructure. Complete authorized execution when requested; a prepared configuration is not a running deployment.

## Fetch current sources

| Requirement | Documentation to retrieve | Inputs and checks |
| --- | --- | --- |
| Host/container installation | [Binary](https://agentgateway.dev/docs/standalone/latest/documentation/setup/install/binary.md), [Docker](https://agentgateway.dev/docs/standalone/latest/documentation/setup/install/docker.md), or explicitly selected standalone Helm | Target host, platform, existing process/configuration owner, startup and storage. |
| OpenAI | [OpenAI](https://agentgateway.dev/docs/standalone/latest/integrations/llm/providers/openai.md) | Customer-selected model, API key/secret source, endpoint and optional project/organization settings where supported. Verify credentials in the gateway environment. |
| Gemini through Vertex AI | [Vertex AI](https://agentgateway.dev/docs/standalone/latest/integrations/llm/providers/vertex.md) | Google Cloud project, region/location, model identifier and Application Default Credentials or supported workload identity. A developer's workstation login does not establish credentials on a server or inside a container. This differs from the Gemini Developer API and its API key. |
| Amazon Bedrock | [Bedrock](https://agentgateway.dev/docs/standalone/latest/integrations/llm/providers/bedrock.md) | AWS region, model/inference-profile ID, IAM identity or role, and credential delivery to the gateway runtime. Model discovery does not prove invocation permission. |
| Client keys | [Virtual keys](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/virtual-keys.md) | Key generation, hashes, metadata identity, strict authentication, model restrictions and secure delivery. Provider credentials and gateway client keys are different. |
| Independent dollar/token allowances | [Per-key budgets](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/budget-limits/per-key.md) | Budget identity, unit, window/reset, block versus audit, persistence and enforcement timing. |
| Dollar accounting | [Model costs](https://agentgateway.dev/docs/standalone/latest/documentation/llm/cost-controls/costs.md) | Correct rates and usage dimensions for every allowed provider/model/alias. Tutorial prices are not customer prices. |
| Durable state and updates | [Database](https://agentgateway.dev/docs/standalone/latest/documentation/setup/database.md), [storage](https://agentgateway.dev/docs/standalone/latest/documentation/setup/storage.md) | Durable counters, file/database ownership, supported updates and restart behavior. |
| UI access | [Launch UI](https://agentgateway.dev/docs/standalone/latest/documentation/setup/ui/launch-ui.md) | Actual listener, authentication and reachability from the intended browser, writable/read-only mode and persistence. |
| Requested masking | [Regex guardrails](https://agentgateway.dev/docs/standalone/latest/documentation/llm/prompt-guards/regex.md) | Detector, request/response placement, replacement versus rejection and streaming limits. |

Use the current documentation indexes to resolve moved pages, then validate syntax against the actual runtime. These discovery URLs do not certify an older or development version.

## Implement and verify

1. **Resolve the target and provider.** Inspect the authorized project and reachable deployment environment. Read existing configuration before asking for missing inputs. Define host versus container addresses and credential paths. Do not introduce Kubernetes for a host/container task.
2. **Reuse the supported runtime.** For a new installation, resolve a currently supported distribution and record what was installed. For an existing installation, inspect it and use applicable docs and native validation. The skill has no fixed release requirement.
3. **Configure the selected provider.** Establish incoming aliases, upstream model IDs, and runtime identity. Preserve existing models and targets. Expose only models whose routing and required pricing are established. Do not activate every available model or silently choose another provider.
4. **Create only the requested identities.** For five keys, create five independent identities and preserve them on reruns. Use supported hashes in configuration. Deliver plaintext through a protected customer-controlled secret/file, never chat, logs, example YAML or source notes. If the customer requests JWT identities, distinguish JWT validation and claim-keyed token limits from native JWT-attributed dollar enforcement; check [edition boundaries](edition-boundaries.md).
5. **Resolve budget semantics.** Ask for the unit, scope and reset/window when missing. Do not turn five independent $10 limits into one $50 pool or silently choose daily resets. Verify supported storage, identity mapping, catalog matches, blocking enforcement and counter persistence. Do not reset live usage to pass a test.
6. **Use the intended network.** Bind requested traffic interfaces with authentication and TLS appropriate to that environment. Keep admin/UI access separate. A protected hostname, authorized tunnel, or same-host loopback may be appropriate; do not return a laptop-local URL for a remote gateway. A loopback listener inside a container is not reachable merely because a port was published.
7. **Verify actual behavior.** Run native configuration validation, start/apply through the existing owner, and send a bounded request through the gateway. Verify credential rejection and independent accounting where requested. Use isolated synthetic fixtures for masking/MCP controls or tiny temporary budgets; do not exhaust real allowances. Mocks do not establish provider/IAM integration or billing accuracy.
8. **Hand over usable endpoints and rollback.** Verify the API and UI from the intended client network. Separate HTTP reachability, interactive UI behavior and persistence. Return the observed runtime, relevant files, protected credential location, observed/unrun checks, source URLs, and the stop/rollback path for task-owned changes.

Dollar budgets charge recorded usage according to documented timing and pricing coverage. The threshold-crossing request and concurrent requests can produce overshoot. Missing prices or usage can prevent charging. A token quota is not an exact dollar cap, and gateway accounting is not the provider's billing control. State those limits when relevant.

Use the [standalone FE workshop](https://github.com/solo-io/fe-enterprise-standalone-agentgateway-workshop) for compatible patterns, and [Solo topics](https://www.solo.io/topics) for requested architectural context. Read the selected lab's prerequisites and edition; a workshop is not configuration authority for another edition or runtime.
