[NetBird Agent Network](https://docs.netbird.io/agent-network) provides an identity-aware access layer for AI agents. It connects agents to LLM APIs, AI gateways, and private resources over NetBird's encrypted network, and applies access policies before traffic reaches the destination.

With agentgateway configured as an Agent Network provider, NetBird authenticates the caller and forwards authorized OpenAI and Anthropic requests to a private agentgateway listener. Agentgateway then authenticates NetBird with a virtual key, routes the request to the appropriate provider, applies gateway policies, and records request telemetry.

## Benefits

- **Keyless access for agents:** Keep upstream provider credentials in agentgateway instead of distributing them to every agent.
- **Identity-aware traffic:** NetBird replaces reserved identity headers with trusted user and group values for each authenticated caller.
- **Layered access control:** Combine NetBird identity and network policies with agentgateway authentication, routing, rate limits, guardrails, and other traffic policies.
- **Private gateway ingress:** Make the agentgateway listener reachable only from the NetBird proxy instead of exposing it directly to clients or the public internet.
- **Auditing and cost visibility:** Attribute agentgateway request logs, token usage, and cost data to the NetBird identity that initiated the request.

## How the integration works

1. An agent connects to an Agent Network endpoint through NetBird's encrypted tunnel.
2. NetBird authenticates the agent and evaluates the applicable Agent Network policy.
3. The NetBird proxy removes caller-supplied reserved headers, adds trusted `x-netbird-user-id` and `x-netbird-groups` values, and presents the agentgateway virtual key.
4. A private agentgateway listener validates the virtual key and routes OpenAI or Anthropic traffic to the configured backend.
5. Agentgateway applies its policies and can record the NetBird identity with request, token, latency, and cost telemetry.

> [!WARNING]
> Trust the NetBird identity headers only when clients cannot reach the agentgateway listener without passing through the NetBird proxy. Enforce this boundary with a Kubernetes NetworkPolicy, service mesh, firewall, or an equivalent private-network control. Treat `x-netbird-groups` as attribution data, not as a delimiter-safe authorization claim.

## Try the end-to-end example

The agentgateway repository includes a Kubernetes example that deploys a self-hosted NetBird Agent Network and places agentgateway behind its proxy. The example demonstrates:

- A private agentgateway listener that is protected by strict virtual-key authentication.
- OpenAI and Anthropic request routing through one Agent Network endpoint.
- Trusted NetBird identity attribution in agentgateway request logs.
- NetworkPolicy enforcement between the NetBird proxy and agentgateway.
- Verification of authorized tunnel traffic and rejection of direct public or invalid-key requests.

The example is a reference deployment. Review its pinned component versions, DNS and LoadBalancer requirements, certificate setup, and production-hardening notes before adapting it to your environment.

{{< cards >}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/netbird-agent-network" title="NetBird end-to-end example" icon="external-link" description="Deploy and verify NetBird Agent Network with agentgateway on Kubernetes." >}}
{{< card link="https://docs.netbird.io/agent-network" title="NetBird Agent Network docs" icon="external-link" description="Learn about Agent Network architecture, policies, providers, usage, and logs." >}}
{{< /cards >}}

## Production considerations

- Use a dedicated virtual key for the NetBird-to-agentgateway hop, store only its hash in the agentgateway authentication Secret, and rotate it according to your credential policy.
- Keep the agentgateway listener private and allow ingress only from the NetBird proxy. A shared key alone does not make caller-supplied identity headers trustworthy.
- Encrypt traffic between the NetBird proxy and agentgateway when your cluster or compliance requirements call for in-cluster encryption.
- Map the trusted identity headers to agentgateway request-log attributes to analyze usage by NetBird user or authorizing group.
- Align model names and aliases between NetBird and agentgateway when you use NetBird usage metering or agentgateway cost reporting.

For provider creation, Agent Network policies, endpoints, and client enrollment, follow the [NetBird Agent Network documentation](https://docs.netbird.io/agent-network).
