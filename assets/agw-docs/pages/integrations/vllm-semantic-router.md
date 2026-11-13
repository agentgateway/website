[vLLM Semantic Router (vSR)](https://vllm-sr.ai/) classifies LLM requests and selects a model based on prompt content. With agentgateway, you can make this semantic decision before routing while continuing to apply gateway policies and record model, token, latency, and cost telemetry. See the [vSR Router API reference](https://vllm-sr.ai/docs/api/router/) for supported frontend and backend API types.

This integration uses vLLM Semantic Router (vSR) to select a model, rather than vLLM to serve inference requests. vSR selects the model, agentgateway routes the request to the corresponding backend, and that backend runs the model and returns the response.

{{< conditional-text include-if="kubernetes" >}}
For inference with vLLM, see [vLLM as an inference provider]({{< link-hextra path="/integrations/llm/providers/vllm/" >}}).
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
To connect to vLLM's OpenAI-compatible API, see [Custom providers]({{< link-hextra path="/integrations/llm/providers/custom/" >}}).
{{< /conditional-text >}}

## How the integration works

{{< reuse-image-light src="img/integrations/vllm-semantic-router-flow.svg" alt="A client sends a request to agentgateway. Agentgateway exchanges the request and model decision with vLLM Semantic Router through ExtProc, enforces model access, forwards to the selected backend, and records telemetry." >}}
{{< reuse-image-dark srcDark="img/integrations/vllm-semantic-router-flow.svg" alt="A client sends a request to agentgateway. Agentgateway exchanges the request and model decision with vLLM Semantic Router through ExtProc, enforces model access, forwards to the selected backend, and records telemetry." >}}

1. **Process the request:** A client sends an LLM request to agentgateway, which calls vSR as an {{< conditional-text include-if="kubernetes" >}}[external processor (ExtProc)]({{< link-hextra path="/documentation/traffic-management/extproc/" >}}){{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}[external processor (ExtProc)]({{< link-hextra path="/documentation/configuration/traffic-management/extproc/" >}}){{< /conditional-text >}} {{< conditional-text include-if="kubernetes" >}}during `PreRouting`, {{< /conditional-text >}}before model selection.
2. **Select a model:** vSR evaluates its configured [signals](https://vllm-sr.ai/docs/tutorials/signal/overview), such as prompt content or caller tier, and returns a processing response that updates the request's `model` field.
3. **Forward the request:** Agentgateway uses the selected model to choose a configured backend, applies gateway policies such as model authorization, and forwards the request for inference. Agentgateway records usage and latency for observability.

When [response caching](https://vllm-sr.ai/docs/tutorials/plugin/response-cache/) is enabled, vSR can return a cached completion through ExtProc, allowing agentgateway to respond without calling the backend.

## Choose an integration path

Use the following guides and examples to configure the integration.

{{< conditional-text include-if="kubernetes" >}}
{{< cards >}}
{{< card link="https://vllm-sr.ai/docs/installation/k8s/agentgateway/" title="Deploy vSR with agentgateway" description="Follow the vSR project guide to deploy the components on Kubernetes and route to vLLM-compatible inference workloads.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/cost-based" title="Evaluate cost-based routing" description="Select between hosted model tiers and measure the result with a model cost catalog and OpenTelemetry.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/tier-aware" title="Configure tier-aware routing with CRDs" description="Use IntelligentPool and IntelligentRoute resources with a separate vSR runtime for each tier.">}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/response-cache/kubernetes" title="Configure response caching on Kubernetes" description="Configure an existing agentgateway installation with vSR, Redis, and the published HomeHub support backend.">}}
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x" >}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/k8s/tier-aware-single-runtime" title="Tier-aware routing with one runtime" description="Combine tier and keyword signals in one vSR runtime configured by canonical YAML in a ConfigMap." >}}
{{< /version >}}
{{< /cards >}}

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x" >}}
The single-runtime example uses `AgentgatewayModel` resources and requires agentgateway v1.5.0 or later, matching CRDs, and the experimental model API setting documented in its README.
{{< /version >}}
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
{{< cards >}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/standalone/tier-aware-single-runtime" title="Standalone tier-aware routing" description="Run agentgateway and one YAML-configured vSR runtime with Docker Compose, and verify model selection and access controls." >}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/response-cache/standalone" title="Standalone response caching" description="Configure an existing standalone gateway with vSR, Redis, and the published HomeHub support backend supplied by Docker Compose." >}}
{{< /cards >}}

Follow the example README to configure credentials, start the containers, send requests, and clean up.
{{< /conditional-text >}}

To request an additional integration example, [create an issue in the agentgateway repository](https://github.com/agentgateway/agentgateway/issues) and describe your use case.

## Integration considerations

- **Client model selection:** The examples use `model: "auto"` to opt in to semantic selection. This value is an example policy convention, not a reserved agentgateway model. If clients can request models explicitly, enforce model entitlements in agentgateway as well as in vSR decisions. {{< conditional-text include-if="kubernetes" >}}You can [validate the request body]({{< link-hextra path="/documentation/traffic-management/transformations/validate/" >}}) to require the automatic path.{{< /conditional-text >}}
- **Backend choice:** vSR can select models served by hosted providers or self-hosted inference workloads. Configure the corresponding [LLM provider]({{< link-hextra path="/integrations/llm/providers/" >}}) or routing backend in agentgateway.
- **Model names:** Keep the names returned by vSR aligned with the models in your agentgateway routes, provider configuration, and cost catalog. {{< conditional-text include-if="kubernetes" >}}You can expose stable client-facing names with [model aliases]({{< link-hextra path="/documentation/llm/alias/" >}}).{{< /conditional-text >}}
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x" >}}
- **Trusted tier context:** The single-runtime examples use caller-supplied user ID and tier headers to demonstrate routing, not authentication. Before exposing them to users, validate identity and bind those headers to trusted entitlements before ExtProc runs. API key authentication alone does not verify a caller-supplied tier.
{{< /version >}}
- **Cost and observability:** vSR makes the semantic decision. Agentgateway remains the source for completed-request telemetry and can calculate realized cost when you configure a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}). Use [LLM metrics and logs]({{< link-hextra path="/documentation/llm/observability/" >}}) {{< conditional-text include-if="kubernetes" >}}or the [OpenTelemetry stack]({{< link-hextra path="/documentation/observability/otel-stack/" >}}) {{< /conditional-text >}}to evaluate the result.

Before a broad rollout, compare routed traffic with a fixed higher-capability-model baseline. Confirm that the policy uses the intended model tiers, then evaluate task completion, user feedback, retries, and escalation rates alongside cost and latency.

## Response cache examples

The [response-cache overview](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-semantic-routing/response-cache) explains cache hits, misses, and a four-request verification walkthrough shared by both deployments. These examples were tested with agentgateway v1.6.0 and pin vSR v0.4.0. Follow each deployment README for its version pins and ExtProc processing modes.

Both examples use the published [HomeHub support demo](https://github.com/solo-io/homehub-support-demo), which returns fixed product-support answers without calling an LLM provider. No LLM credentials or local backend image build are needed. On a miss, agentgateway calls HomeHub and passes its response through vSR to store it in Redis. On a hit, vSR returns the cached completion through ExtProc and HomeHub is not called.

The examples send `stream: false` Chat Completions requests. This client setting is independent of ExtProc body processing: requests use `FullDuplexStreamed`, while responses use `Buffered` so vSR can cache the complete JSON response. Use a unique `X-Request-ID` for each request to correlate cache lookup with response storage. Verify hits with the `x-vsr-cache-hit` response header and an unchanged HomeHub backend request count.

## Response caching in production

The response-cache examples use fixed, public answers and a single Redis instance without authentication or TLS. When adapting them to your application, consider how cached answers are matched, who can reuse them, and how Redis data is managed.

> [!NOTE]
> With vSR v0.4.0, each request must include a unique `X-Request-ID` so vSR can associate the request with its response and store it in the cache. Generate the ID in your client before sending the request. For example, add `-H "X-Request-ID: $(uuidgen)"` to a curl command.
>
> Adding the header through an `llm.policies` transformation is too late for this integration: ExtProc runs before that transformation.

### Cache correctness

Test the similarity threshold with representative questions, including similar questions that require different answers. For example, questions about HomeHub X2 and X3 might match even though their reset instructions differ. The examples use `0.70` to demonstrate paraphrase matching, so choose a threshold based on your own data.

Use `scope: global` only for answers that every caller may read. For personalized responses, choose an appropriate cache scope and derive caller identity from trusted authentication data. Set a cache lifetime that reflects how often answers change, and plan how to invalidate stale entries. See the [vSR response-cache documentation](https://vllm-sr.ai/docs/tutorials/plugin/response-cache/) for modes, scopes, and expiration settings.

### Protect access

Restrict network access to vSR and Redis, enable Redis authentication, and use TLS between agentgateway and vSR and between vSR and Redis. Keep credentials in a secret store, such as Kubernetes Secrets. See [Redis security](https://redis.io/docs/latest/operate/oss_and_stack/management/security/).{{< conditional-text include-if="kubernetes" >}} For the agentgateway-to-vSR connection, see [agentgateway backend TLS]({{< link-hextra path="/documentation/security/backendtls/" >}}).{{< /conditional-text >}}

### Redis operations

Size Redis memory and storage for cached responses, embeddings, retention time, and write volume. Decide how much cache loss or downtime the application can tolerate, then configure persistence, replication, failover, and backups accordingly. The Kubernetes PVC and standalone Compose volume preserve Redis data across restarts but do not provide high availability. See [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) for durability and backup options.
