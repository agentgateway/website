[vLLM Semantic Router (vSR)](https://vllm-sr.ai/) classifies LLM requests and selects a model based on prompt content. With agentgateway, you can make this semantic decision before routing while continuing to apply gateway policies and record model, token, latency, and cost telemetry. See the [vSR Router API reference](https://vllm-sr.ai/docs/api/router/) for supported frontend and backend API types.

This integration uses vLLM Semantic Router (vSR) to select a model, rather than vLLM to serve inference requests. vSR selects the model, agentgateway routes the request to the corresponding backend, and that backend runs the model and returns the response. For inference with vLLM, see {{< conditional-text include-if="kubernetes" >}}[vLLM as an inference provider]({{< link-hextra path="/integrations/llm/providers/vllm/" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}){{< /conditional-text >}}.

## How the integration works

The following diagram shows the [cost-based routing example](https://agentgateway.dev/blog/2026-07-17-semantic-routing-llm-costs/). A coding agent requests the stable `auto` model, vSR selects a lower-cost or higher-capability model, and agentgateway forwards the request and records the result.

{{< reuse-image-light src="img/integrations/vllm-semantic-router-cost-routing.svg" alt="A coding agent sends model auto to agentgateway. Agentgateway asks vLLM Semantic Router to select a model, routes the request to a lower-cost or higher-capability model, and records catalog-priced telemetry." >}}
{{< reuse-image-dark srcDark="img/integrations/vllm-semantic-router-cost-routing.svg" alt="A coding agent sends model auto to agentgateway. Agentgateway asks vLLM Semantic Router to select a model, routes the request to a lower-cost or higher-capability model, and records catalog-priced telemetry." >}}

The request follows these component boundaries:

1. A client sends a supported request to agentgateway.
2. Agentgateway calls vSR as an {{< conditional-text include-if="kubernetes" >}}[external processor]({{< link-hextra path="/documentation/traffic-management/extproc/" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[external processor]({{< link-hextra path="/documentation/configuration/traffic-management/extproc/" >}}){{< /conditional-text >}} before forwarding the request to a backend.
3. vSR evaluates its semantic, complexity, keyword, context, and structure signals. It returns the selected model in its processing response.
4. Agentgateway applies the routing decision and forwards the request to the configured provider or inference workload.
5. Agentgateway records the requested and selected models alongside usage, latency, and optional catalog-priced cost data.

{{< conditional-text include-if="kubernetes" >}}The `PreRouting` phase makes the vSR decision available before agentgateway evaluates HTTPRoute matches. Use it when vSR changes the model or adds a header used for routing.{{< /conditional-text >}}

When [response caching](https://vllm-sr.ai/docs/tutorials/plugin/response-cache/) is enabled, vSR can instead return a cached completion as an immediate ExtProc response. Agentgateway returns the response to the client without calling the configured backend.

## Choose an integration path

The vSR and agentgateway projects provide complementary guides. Choose the one that matches the models and outcome that you want to evaluate.

{{< cards >}}
{{< card link="https://vllm-sr.ai/docs/installation/k8s/agentgateway/" title="Deploy vSR with agentgateway" description="Follow the vSR project guide to deploy the components on Kubernetes and route to vLLM-compatible inference workloads.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/cost-based" title="Evaluate cost-based routing" description="Select between hosted model tiers and measure the result with a model cost catalog and OpenTelemetry.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/tier-aware" title="Configure tier-aware routing" description="Select separate vSR configurations and model pools for authenticated Basic, Standard, and Pro callers.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/response-cache/kubernetes" title="Configure response caching on Kubernetes" description="Reuse responses to semantically equivalent requests with the Redis-backed example.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/response-cache/standalone" title="Standalone response caching" description="Reuse semantically equivalent responses with agentgateway, vSR, Redis, and a deterministic backend in Docker Compose." >}}
{{< /cards >}}

Each agentgateway example provides the versions, configuration, and commands needed to run its scenario. Refer to the vSR documentation for the available routing and cache settings.

> [!NOTE]
> Use the component versions and ExtProc processing modes documented in the example you choose.

## Integration considerations

- **Client model selection:** The cost-based example uses `model: "auto"` to opt in to semantic selection. This value is an example policy convention, not a reserved agentgateway model. Choose whether clients may request models directly or must use automatic selection.
- **Backend choice:** vSR can select models served by hosted providers or Kubernetes inference workloads. Configure the corresponding [LLM provider]({{< link-hextra path="/integrations/llm/providers/" >}}) or routing backend in agentgateway.
- **Model names:** Keep the names returned by vSR aligned with the models in your agentgateway routes, provider configuration, and cost catalog.{{< conditional-text include-if="kubernetes" >}} You can expose stable client-facing names with [model aliases]({{< link-hextra path="/documentation/llm/alias/" >}}).{{< /conditional-text >}}
- **Cost and observability:** vSR makes the semantic decision. Agentgateway remains the source for completed-request telemetry and can calculate realized cost when you configure a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). Use [LLM metrics and logs]({{< link-hextra path="/documentation/llm/observability/" >}}){{< conditional-text include-if="kubernetes" >}} or the [OpenTelemetry stack]({{< link-hextra path="/documentation/observability/otel-stack/" >}}){{< /conditional-text >}} to evaluate the result.

Before a broad rollout, compare routed traffic with a fixed higher-capability-model baseline. Confirm that the policy uses both tiers, then evaluate task completion, user feedback, retries, and escalation rates alongside cost and latency.

## Response caching in production

The response-cache examples use fixed, public answers and a single Redis instance without authentication or TLS. When adapting them to your application, consider how cached answers are matched, who can reuse them, and how Redis data is managed.

### Cache correctness

Test the similarity threshold with representative questions, including similar questions that require different answers. For example, questions about HomeHub X2 and X3 might match even though their reset instructions differ. The examples use `0.70` to demonstrate paraphrase matching, so choose a threshold based on your own data.

Use `scope: global` only for answers that every caller may read. For personalized responses, choose an appropriate cache scope and derive caller identity from trusted authentication data. Set a cache lifetime that reflects how often answers change, and plan how to invalidate stale entries. See the [vSR response-cache documentation](https://vllm-sr.ai/docs/tutorials/plugin/response-cache/) for modes, scopes, and expiration settings.

### Protect access

Restrict network access to vSR and Redis, enable Redis authentication, and use TLS between agentgateway and vSR and between vSR and Redis. Keep credentials in a secret store, such as Kubernetes Secrets. See [Redis security](https://redis.io/docs/latest/operate/oss_and_stack/management/security/) and, for Kubernetes deployments, [agentgateway backend TLS](https://agentgateway.dev/docs/kubernetes/main/documentation/security/backendtls/).

### Redis operations

Size Redis memory and storage for cached responses, embeddings, retention time, and write volume. Decide how much cache loss or downtime the application can tolerate, then configure persistence, replication, failover, and backups accordingly. The example's persistent volume preserves data across a Redis restart but does not provide high availability. See [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) for durability and backup options.
