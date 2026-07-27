[vLLM Semantic Router (vSR)](https://vllm-sr.ai/) classifies LLM requests and selects a model based on prompt content. With agentgateway, you can make this semantic decision before routing while continuing to apply gateway policies and record model, token, latency, and cost telemetry. See the [vSR Router API reference](https://vllm-sr.ai/docs/api/router/) for supported frontend and backend API types.

This integration is distinct from using [vLLM as an inference provider]({{< link-hextra path="/llm/providers/vllm/" >}}). vSR provides the model-selection policy. Your configured provider, Kubernetes Service, or InferencePool serves the selected model.

## How the integration works

The following diagram shows the [cost-based routing example](/blog/2026-07-17-semantic-routing-llm-costs/). A coding agent requests the stable `auto` model, vSR selects a lower-cost or higher-capability model, and agentgateway forwards the request and records the result.

{{< reuse-image-light src="img/integrations/vllm-semantic-router-cost-routing.svg" alt="A coding agent sends model auto to agentgateway. Agentgateway asks vLLM Semantic Router to select a model, routes the request to a lower-cost or higher-capability model, and records catalog-priced telemetry." >}}
{{< reuse-image-dark srcDark="img/integrations/vllm-semantic-router-cost-routing.svg" alt="A coding agent sends model auto to agentgateway. Agentgateway asks vLLM Semantic Router to select a model, routes the request to a lower-cost or higher-capability model, and records catalog-priced telemetry." >}}

The request follows these component boundaries:

1. A client sends a supported request to agentgateway.
2. An {{< reuse "agw-docs/snippets/policy.md" >}} calls vSR as an external processor during the `PreRouting` phase.
3. vSR evaluates its semantic, complexity, keyword, context, and structure signals. It returns the selected model in its processing response.
4. Agentgateway applies the routing decision and forwards the request to the configured provider or inference workload.
5. Agentgateway records the requested and selected models alongside usage, latency, and optional catalog-priced cost data.

`PreRouting` is important when the vSR decision changes the model or adds a header that an HTTPRoute uses for matching. It makes the result available before agentgateway evaluates the route.

## Choose an integration path

The vSR and agentgateway projects provide complementary guides. Choose the one that matches the models and outcome that you want to evaluate.

{{< cards >}}
{{< card link="https://vllm-sr.ai/docs/installation/k8s/agentgateway/" title="Deploy vSR with agentgateway" icon="external-link" description="Follow the vSR project guide to deploy the components on Kubernetes and route to vLLM-compatible inference workloads.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing" title="Evaluate cost-based routing" icon="external-link" description="Use the agentgateway example to select between hosted model tiers and measure the result with a model cost catalog and OpenTelemetry.">}}
{{< /cards >}}

The vSR deployment guide owns the installation, Helm values, and semantic-router configuration. The agentgateway example owns the cost-routing policy and runnable gateway resources. Keeping those details with their projects avoids version drift in this integration overview.

{{< callout type="info" >}}
Current vSR examples require agentgateway 1.3.0 or later for the external-processing options that control request streaming and mode overrides.
{{< /callout >}}

## Integration considerations

- **Client model selection:** The cost-based example uses `model: "auto"` to opt in to semantic selection. This value is an example policy convention, not a reserved agentgateway model. You can let clients request model tiers directly or [validate the request body]({{< link-hextra path="/traffic-management/transformations/validate/" >}}) to require the automatic path.
- **Backend choice:** vSR can select models served by hosted providers or Kubernetes inference workloads. Configure the corresponding [LLM provider]({{< link-hextra path="/llm/providers/" >}}) or routing backend in agentgateway.
- **Model names:** Keep the names returned by vSR aligned with the models in your agentgateway routes, provider configuration, and cost catalog. You can expose stable client-facing names with [model aliases]({{< link-hextra path="/llm/alias/" >}}).
- **Cost and observability:** vSR makes the semantic decision. Agentgateway remains the source for completed-request telemetry and can calculate realized cost when you configure a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}). Use [LLM metrics and logs]({{< link-hextra path="/llm/observability/" >}}) or the [OpenTelemetry stack]({{< link-hextra path="/observability/otel-stack/" >}}) to evaluate the result.

Before a broad rollout, compare routed traffic with a fixed higher-capability-model baseline. Confirm that the policy uses both tiers, then evaluate task completion, user feedback, retries, and escalation rates alongside cost and latency.
