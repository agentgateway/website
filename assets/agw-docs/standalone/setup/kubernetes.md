This section of the agentgateway docs (`agentgateway.dev/docs/standalone`) covers deploying and operating agentgateway in standalone mode, where your configuration file is the source of truth. That includes the [standalone Helm chart]({{< link-hextra path="/setup/install/helm/" >}}), which runs the standalone binary as a Kubernetes Deployment.

The managed Kubernetes deployment model is a different product surface, not another standalone installation method. It adds a control plane, Gateway API support, and dynamic Kubernetes resources, and it is documented separately.

Use the Kubernetes docs instead of this section when you want any of the following.

| You want | Where it is documented |
| --- | --- |
| A control plane that watches Kubernetes resources and configures proxies dynamically | [Kubernetes docs](https://agentgateway.dev/docs/kubernetes/) |
| `Gateway`, `HTTPRoute`, and other Gateway API resources | [Kubernetes docs](https://agentgateway.dev/docs/kubernetes/) |
| The `AgentgatewayBackend`, `AgentgatewayPolicy`, `AgentgatewayModel`, and `AgentgatewayParameters` custom resources | [Kubernetes docs](https://agentgateway.dev/docs/kubernetes/) |
| Kubernetes to run one unmanaged Deployment from a configuration file you control | [Install with Helm]({{< link-hextra path="/setup/install/helm/" >}}) in this section |

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Get started with agentgateway on Kubernetes" icon="external-link">}}
{{< /cards >}}
