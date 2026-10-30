[Devin Desktop](https://devin.ai/desktop), the AI-powered code editor from Cognition (formerly Windsurf), sends its model requests to Cognition's service. You cannot point Devin Desktop at your own LLM or at an LLM route on your agentgateway proxy in Kubernetes.

Devin Desktop can send all of its network traffic through an HTTP proxy, which you set in its **Http: Proxy** setting. Agentgateway can be that proxy when it runs as an egress proxy. The egress proxy is documented for the standalone agentgateway binary, which you can run on the machine where Devin Desktop runs or on a host that it can reach. With the egress proxy, agentgateway can require proxy credentials, log every destination that Devin Desktop connects to, and restrict which destinations it can reach.

To set it up, see the standalone guides:

* [Devin Desktop](https://agentgateway.dev/docs/standalone/latest/integrations/llm/clients/devin/), to run agentgateway as Devin Desktop's proxy.
* [Egress proxy](https://agentgateway.dev/docs/standalone/latest/documentation/configuration/egress-proxy/), for the proxy modes and options.
