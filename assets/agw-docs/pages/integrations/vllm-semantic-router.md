[vLLM Semantic Router (vSR)](https://vllm-sr.ai/) classifies LLM requests and selects a model based on prompt content. With agentgateway, you can make this semantic decision before routing while continuing to apply gateway policies and record model, token, latency, and cost telemetry. See the [vSR Router API reference](https://vllm-sr.ai/docs/api/router/) for supported frontend and backend API types.

This integration is distinct from using vLLM as an inference provider. vSR provides the model-selection policy while your configured backend serves the selected model.

{{< conditional-text include-if="kubernetes" >}}
For inference with vLLM, see [vLLM as an inference provider]({{< link-hextra path="/integrations/llm/providers/vllm/" >}}).
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
For inference with vLLM, see [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}).
{{< /conditional-text >}}

## How the integration works

Agentgateway sends the request to vSR for model selection. vSR evaluates its configured signals and returns a model decision. Agentgateway enforces model access, forwards the request to the selected backend, and records telemetry. The following diagram shows this flow in both standalone and Kubernetes modes.

{{< reuse-image-light src="img/integrations/vllm-semantic-router-flow.svg" alt="A client sends a request to agentgateway. Agentgateway exchanges the request and model decision with vLLM Semantic Router through ExtProc, enforces model access, forwards to the selected backend, and records telemetry." >}}
{{< reuse-image-dark srcDark="img/integrations/vllm-semantic-router-flow.svg" alt="A client sends a request to agentgateway. Agentgateway exchanges the request and model decision with vLLM Semantic Router through ExtProc, enforces model access, forwards to the selected backend, and records telemetry." >}}

The request follows these component boundaries:

1. A client sends a supported request to agentgateway.
2. Agentgateway calls vSR as an external processor (ExtProc) before selecting the model.
3. vSR evaluates its configured signals. It returns the selected model in its processing response.
4. Agentgateway applies the routing decision and forwards the request to the configured provider or inference workload.
5. Agentgateway records the requested and selected models alongside usage, latency, and optional catalog-priced cost data.

{{< conditional-text include-if="kubernetes" >}}
The [Kubernetes tier-aware routing example with one runtime](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/tier-aware-single-runtime) uses vSR to select models based on the caller's tier and request content. A Gateway-level {{< reuse "agw-docs/snippets/policy.md" >}} calls vSR during `PreRouting`. After vSR rewrites the request body's `model` field, `AgentgatewayModel` routing selects the provider and enforces model access. `HTTPRoute` matching occurs earlier and cannot use model or header changes produced by this ExtProc call to select a provider.
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
The [standalone tier-aware routing example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/standalone/tier-aware-single-runtime) uses one vSR runtime to select models based on the caller's tier and request content. Its `llm.policies.extProc` configuration calls vSR before model selection. vSR rewrites the request body's `model` field, and agentgateway selects the matching entry in `llm.models`. Each model's `authorization` rules enforce access after selection, including when a client explicitly requests a model. For external-processing configuration, see [External processing]({{< link-hextra path="/documentation/configuration/traffic-management/extproc/" >}}).
{{< /conditional-text >}}

When semantic caching is enabled, vSR can instead return a cached completion as an immediate ExtProc response. Agentgateway returns the response to the client without calling the configured backend.

## Choose an integration path

The vSR and agentgateway projects provide complementary guides. Choose the one that matches the models and outcome that you want to evaluate.

{{< conditional-text include-if="kubernetes" >}}
{{< cards >}}
{{< card link="https://vllm-sr.ai/docs/installation/k8s/agentgateway/" title="Deploy vSR with agentgateway" description="Follow the vSR project guide to deploy the components on Kubernetes and route to vLLM-compatible inference workloads.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/cost-based" title="Evaluate cost-based routing" description="Select between hosted model tiers and measure the result with a model cost catalog and OpenTelemetry.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/tier-aware" title="Configure tier-aware routing with CRDs" description="Use IntelligentPool and IntelligentRoute resources with a separate vSR runtime for each tier.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/semantic-cache" title="Configure semantic caching" description="Reuse responses to semantically equivalent requests with the Redis-backed example.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/tier-aware-single-runtime" title="Tier-aware routing with one runtime" description="Combine tier and keyword signals in one vSR runtime configured by canonical YAML in a ConfigMap." >}}
{{< /cards >}}

The single-runtime example uses `AgentgatewayModel` resources and requires the matching agentgateway version, CRDs, and experimental model API setting documented in its README.
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
{{< cards >}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/standalone/tier-aware-single-runtime" title="Standalone tier-aware routing" description="Run agentgateway and one YAML-configured vSR runtime with Docker Compose, and verify model selection and access controls." >}}
{{< /cards >}}

Follow the example README to configure credentials, start the containers, send requests, and clean up.
{{< /conditional-text >}}

To request an additional integration example, [create an issue in the agentgateway repository](https://github.com/agentgateway/agentgateway/issues) and describe your use case.

## Integration considerations

- **Client model selection:** The examples use `model: "auto"` to opt in to semantic selection. This value is an example policy convention, not a reserved agentgateway model. If clients can request models explicitly, enforce model entitlements in agentgateway as well as in vSR decisions.
- **Backend choice:** vSR can select models served by hosted providers or self-hosted inference workloads. Configure the corresponding [LLM provider]({{< link-hextra path="/integrations/llm/providers/" >}}) or routing backend in agentgateway.
- **Model names:** Keep the names returned by vSR aligned with the models in your agentgateway routes, provider configuration, and cost catalog.
- **Trusted tier context:** The single-runtime examples use caller-supplied user ID and tier headers to demonstrate routing, not authentication. Before exposing them to users, validate identity and bind those headers to trusted entitlements before ExtProc runs. API key authentication alone does not verify a caller-supplied tier.
- **Cost and observability:** vSR makes the semantic decision. Agentgateway remains the source for completed-request telemetry and can calculate realized cost when you configure a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). Use [LLM metrics and logs]({{< link-hextra path="/documentation/llm/observability/" >}}) to evaluate the result.

Before a broad rollout, compare routed traffic with a fixed higher-capability-model baseline. Confirm that the policy uses the intended model tiers, then evaluate task completion, user feedback, retries, and escalation rates alongside cost and latency.
