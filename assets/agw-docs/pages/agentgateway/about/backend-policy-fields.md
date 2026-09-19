### Backend policy fields

A `traffic` policy processes a request as it passes through a Gateway listener or route. A `backend` policy applies to the destination that agentgateway selects for that request, and each field configures one aspect of the connection to it.

Combine fields in one policy when they share a target and a lifecycle. For the resources that each field can attach to, and for how two policies that set the same field merge, see [Targeting and merging]({{< link-hextra path="/documentation/about/policies/target-merge/" >}}).

| Field | Purpose | Guide |
| -- | -- | -- |
| `backend.tcp` | Set the connection timeout and TCP keepalive probes. | [Backend timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/backend/" >}}) and [HTTP connection settings]({{< link-hextra path="/documentation/resiliency/connection/#backend" >}}) |
| `backend.http` | Select the upstream HTTP version and set the backend response deadline. | [Backend timeouts]({{< link-hextra path="/documentation/resiliency/timeouts/backend/" >}}) and [HTTP connection settings]({{< link-hextra path="/documentation/resiliency/connection/#backend" >}}) |
| `backend.tls` | Originate TLS or mutual TLS (mTLS) and configure certificate validation. | [Backend TLS]({{< link-hextra path="/documentation/security/backendtls/" >}}) |
| `backend.tunnel` | Reach the destination through an HTTP CONNECT proxy. | [Policy API reference]({{< link-hextra path="/reference/api/" >}}) |
| `backend.auth` | Add credentials or exchange, sign, or pass through tokens for the destination. | [Backend authentication]({{< link-hextra path="/documentation/security/backend-authn/" >}}) |
| `backend.extAuth` | Run external authorization after agentgateway selects the destination. | [Bring your own external authorization service]({{< link-hextra path="/documentation/security/extauth/byo-ext-auth-service/" >}}) |
| `backend.transformation` | Transform requests sent to the destination and responses returned from it. | [Transformations]({{< link-hextra path="/documentation/traffic-management/transformations/" >}}) |
| `backend.health` | Detect unhealthy endpoints, evict them, and restore them after recovery. | [Backend health]({{< link-hextra path="/documentation/resiliency/backend-health/" >}}) |
| `backend.ai` | Configure prompt guards, routing, transformations, and other AI-specific behavior. | [LLM features]({{< link-hextra path="/documentation/llm/" >}}) |
| `backend.mcp` | Configure Model Context Protocol (MCP) authorization, authentication, and guardrails. | [MCP features]({{< link-hextra path="/documentation/mcp/" >}}) |
