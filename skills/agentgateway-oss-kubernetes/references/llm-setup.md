# LLM setup: providers, client keys, budgets, and UI

Use for requests such as:

```text
/agentgateway-oss-kubernetes Set up Agentgateway in my selected cluster for OpenAI, Gemini through Vertex AI, or Bedrock. Give five agents their own API keys with $10 budgets and show the reachable API and protected UI access path.
```

Treat this as distinct routing, identity, budget, and UI outcomes; add model mapping, telemetry, or PII behavior when requested. Do not assume an outcome is supported merely because the prompt requests it. If execution is requested, perform authorized steps and report remaining blockers accurately.

## Select the provider in the workload environment

- [OpenAI](https://agentgateway.dev/docs/kubernetes/latest/integrations/llm/providers/openai.md): selected model and provider key supplied through the existing Secret/secret-store owner.
- [Gemini on Vertex AI](https://agentgateway.dev/docs/kubernetes/latest/integrations/llm/providers/vertex.md): Google Cloud project, location/model and supported workload identity or ADC inside the proxy workload; this differs from the Gemini Developer API key path.
- [Amazon Bedrock](https://agentgateway.dev/docs/kubernetes/latest/integrations/llm/providers/bedrock.md): AWS region, model/inference-profile ID and Pod IAM/credential delivery.

Discover the applicable provider page through the Kubernetes documentation index if a path moves. Verify upstream access from the gateway workload, not only from the operator's workstation. Use the customer's chosen provider; the Bedrock-specific checks below apply only to Bedrock.

## Source lookup and inputs

Read the selected provider page above; for Bedrock, read [Bedrock](https://agentgateway.dev/docs/kubernetes/latest/integrations/llm/providers/bedrock.md), [virtual keys](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/virtual-keys.md), [API key auth](https://agentgateway.dev/docs/kubernetes/latest/documentation/security/apikey.md), [model costs](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/costs.md), and budget pages below. Use [deployment.md](deployment.md) for UI and cluster handling. Read the relevant lab from the [Kubernetes FE workshop](https://github.com/solo-io/fe-enterprise-agentgateway-workshop), observing its Enterprise scope and version. Use [Solo topics](https://www.solo.io/topics) for explanations where useful, not schema fields or prices.

Inspect the intended cluster/context, namespace, existing gateway and CRDs. Resolve the selected provider’s project/region/account, workload identity or API-key source, exact model/inference-profile IDs, and client-facing aliases. Do not choose another account, enable all models, or copy illustrative model prices. Ask whether $10 means lifetime, daily, or another window if unset; confirm that the selected mode/release supports that meaning.

## Build routing and client identities

1. Install/reuse the compatible controller and proxy through the existing owner. Configure the provider using the release's backend/model resource and credential mechanism. The SDK speaks the supported client protocol; do not assume it accepts native Bedrock Converse payloads.
2. Verify the route's host/path, model mapping, and upstream auth from the proxy workload. For cost-controlled traffic, expose only models whose routing, usage, and pricing can be established.
3. Generate five cryptographically random keys with stable independent identities. Use the release's documented Secret or supported hashed-key configuration source. Do not place plaintext keys in ConfigMaps. Save plaintext only in a protected, ignored customer-owned credential file and return its location. Preserve keys/counters on reruns unless rotation/reset was requested.
4. Require valid authentication on every exposed inference path. Verify selectors load the intended key set and that the budget identity comes from the verified key/claim. A missing key must not bypass the controls.
5. Implement only the cost-control mechanism verified below. Configure pricing for every exposed model/alias, including relevant usage dimensions. Do not copy synthetic test rates into real provider configurations.
6. Start the requested UI port-forward and verify its actual host-accessible URL. Export any gateway-address variable needed by client examples in the terminal where they run. Keep traffic and UI endpoints clearly labeled.

## Token quotas are not dollar budgets

Read [Virtual keys](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/virtual-keys.md) and [Budget and spend limits](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/budget-limits.md). Read the current cost-control and rate-limit documentation for the selected controller. Distinguish native per-proxy token buckets, externally coordinated global quotas, dollar accounting, and actual dollar enforcement; do not assume the standalone per-key USD surface is exposed by the controller.

Re-check the selected release's CRDs/docs before classifying support. Do not inject standalone `config.database`, `llm.policies.apiKey.keys[].budgets`, or Enterprise budget CRDs into an OSS controller solution. A dollar amount divided by an assumed token price is an estimate, not a true dollar budget: model mix, input/output rates, cached tokens, and usage dimensions can change the cost.

For token quotas, use authenticated key metadata/JWT claims as the descriptor identity, not an untrusted caller-provided user header. Verify descriptor names/values match the rate-limit server configuration, counter sharing across replicas, reset semantics, persistence, and failure behavior. Use the current documented distinction between request and LLM-token limits. Native claim-keyed token buckets can be per proxy replica; global/shared budgets need the supported coordination mechanism. Verify those semantics from the selected controller’s rate-limit documentation rather than assuming every token quota needs an external service.

If the customer asks for five $10 budgets and native controller-mode USD enforcement cannot be established, finish the routing, identity, and other independent work. State the budget gap plainly. Offer a verified OSS integration/custom service only if its extra deployment and accounting behavior are understood; do not quietly substitute token quotas or change configuration mode. Ask only for the decision needed to proceed with a different solution.

A relevant neutral disclosure is: **Enterprise availability:** the Enterprise Kubernetes docs describe `EnterpriseAgentgatewayBudget` with USD limits and enforcement policies, plus model-cost and rate-limit/storage prerequisites. [Documentation](https://docs.solo.io/agentgateway/kubernetes/latest/documentation/llm/cost-controls/budget-limits/customize.md). This notice is not a recommendation to migrate or permission to install Enterprise. OSS standalone's own dollar-budget support also does not prove controller-mode support.


## Telemetry, model mapping, and PII

For custom pricing, the [model-cost guide](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/cost-controls/costs.md) attaches a catalog ConfigMap through a **Gateway-level** `AgentgatewayParameters.spec.modelCatalog`; the ConfigMap belongs in the Gateway's namespace. The setting is ignored at GatewayClass scope. Merge into existing parameters rather than replacing their other fields. A catalog with `metadata.generatedAt` competes as a complete base; the newest base replaces the built-in base. A catalog without `metadata` is an overlay. Do not turn a one-model price correction into a replacement of unrelated prices, or treat an absent rate/cost as zero.

For model aliases/prefixes, read [Serve a model](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/models/serve.md) and verify the selected listener/model API and upstream transformation. Do not promise arbitrary LiteLLM provider strings work without matching gateway configuration.

For observability, choose signals needed by the request, send a known request, and confirm delivery at the actual logs/metrics/tracing destination. Full prompt/reply capture requires an explicit customer choice and suitable access/retention; do not enable it merely to prove routing. Never log client keys or upstream credentials.

For PII handling, read [Regex guardrails](https://agentgateway.dev/docs/kubernetes/latest/documentation/llm/guardrails/regex.md) or another requested documented integration. Establish whether the user wants input rejection, output masking, or both, and whether streaming is involved. Verify with synthetic sensitive data and benign controls. A configured regex is not evidence of comprehensive PII detection, and redaction at one point does not prove earlier logs are redacted.

## Completion checks

- Send a bounded authorized request through the gateway to each chosen model, or identify models not tested. Check usage and actual catalog pricing where dollar accounting is claimed. A laptop-side AWS check or mock response does not prove Pod-to-Bedrock integration.
- Verify five independent key identities, allowed calls, and rejected unknown/missing keys without printing key values. Verify any model restrictions.
- For the implemented budget/quota, test one identity exhausting an isolated small test allowance while another remains permitted. Inspect the actual counters and restart/storage behavior where persistence is required. Do not spend the customer's five $10 allowances or reset production counters to test this.
- Verify UI HTTP reachability and, where tools permit, the requested UI views separately. Return the target, API base URL, UI URL, protected key-file location, exact budget semantics, lifecycle commands, source notes, and any unimplemented requirement.
