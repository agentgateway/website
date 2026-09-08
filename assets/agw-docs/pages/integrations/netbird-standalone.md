[NetBird Agent Network](https://docs.netbird.io/agent-network) provides an identity-aware access layer for AI agents. It connects agents to LLM APIs, AI gateways, and private resources over NetBird's encrypted network, and applies access policies before traffic reaches the destination.

With agentgateway configured as an Agent Network provider, NetBird authenticates the caller and forwards authorized OpenAI and Anthropic requests to a private agentgateway listener. Agentgateway then authenticates NetBird with a virtual key, routes the request to the appropriate provider, applies gateway policies, and records request telemetry.

## Benefits

- **Keyless access for agents:** Keep upstream provider credentials in agentgateway instead of distributing them to every agent.
- **Identity-aware traffic:** NetBird replaces reserved identity headers with trusted user and group values for each authenticated caller.
- **Layered access control:** Combine NetBird identity and network policies with agentgateway authentication, routing, rate limits, guardrails, and other traffic policies.
- **Private gateway ingress:** Make the AI listener reachable only from the NetBird proxy instead of exposing it directly to clients or the public internet.
- **Auditing and cost visibility:** Attribute agentgateway request logs, token usage, and cost data to the NetBird identity that initiated the request.

## How the integration works

1. An agent connects to an Agent Network endpoint through NetBird's encrypted tunnel.
2. NetBird authenticates the agent and evaluates the applicable Agent Network policy.
3. The NetBird proxy removes caller-supplied reserved headers, adds trusted `x-netbird-user-id` and `x-netbird-groups` values, and presents the agentgateway virtual key.
4. A private agentgateway listener validates the virtual key and routes OpenAI or Anthropic traffic to the configured backend.
5. Agentgateway applies its policies and can record the NetBird identity with request, token, latency, and cost telemetry.

> [!WARNING]
> Trust the NetBird identity headers only when clients cannot reach the private AI listener without passing through the NetBird proxy. Enforce this boundary with a host firewall, private network, or an equivalent control. Treat `x-netbird-groups` as attribution data, not as a delimiter-safe authorization claim.

## Set up the integration

1. Configure agentgateway with the OpenAI, Anthropic, or other compatible backends that your agents need.
2. Protect the listener that NetBird uses with a dedicated virtual key. Give NetBird the key and configure agentgateway to validate the same value.
3. Restrict the listener so that only the NetBird proxy can reach it.
4. In the NetBird dashboard, create an `agentgateway` Agent Network provider with the private proxy URL and virtual key.
5. Create an Agent Network endpoint and policies that grant the intended agents access to the provider.
6. Optionally add the trusted NetBird identity headers to agentgateway request logs for per-user and per-group attribution.

Follow the [NetBird Agent Network documentation](https://docs.netbird.io/agent-network) for provider creation, policies, endpoints, and client enrollment.

## Try the end-to-end example

The agentgateway repository includes a standalone Docker Compose example that runs NetBird and agentgateway on one Docker host. It uses two agentgateway instances: a public management gateway terminates TLS and routes NetBird management and dashboard traffic, while a private AI gateway accepts requests from the NetBird proxy. The example demonstrates:

- A private AI listener that is protected by strict virtual-key authentication.
- OpenAI and Anthropic request routing through one Agent Network endpoint.
- Trusted NetBird identity attribution in agentgateway request logs.
- Static management and wildcard certificates generated from a private demo certificate authority (CA).
- Verification of management connectivity, private listener exposure, virtual-key authentication, and requests through the NetBird tunnel.

The example is a reference deployment. Review its pinned development images, Docker host and DNS requirements, certificate trust setup, and production-hardening notes before adapting it to your environment. For production, automate certificate renewal and deployment; native standalone ACME lifecycle support is tracked in [#3293](https://github.com/agentgateway/agentgateway/issues/3293).

{{< cards >}}
{{< card link="https://docs.netbird.io/agent-network" title="NetBird Agent Network docs" icon="external-link" description="Learn about Agent Network architecture, policies, providers, usage, and logs." >}}
{{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/netbird-agent-network/standalone" title="NetBird standalone example" icon="external-link" description="Deploy and verify NetBird Agent Network with agentgateway using Docker Compose." >}}
{{< /cards >}}

## Production considerations

- Use a dedicated virtual key for the NetBird-to-agentgateway hop and rotate it according to your credential policy.
- Keep the AI listener private and allow ingress only from the NetBird proxy. A shared key alone does not make caller-supplied identity headers trustworthy.
- Use TLS between the NetBird proxy and agentgateway when the network path is not already protected to your requirements.
- Align model names and aliases between NetBird and agentgateway when you use NetBird usage metering or agentgateway cost reporting.
