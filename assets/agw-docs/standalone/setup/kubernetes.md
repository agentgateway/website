Agentgateway runs in one of two modes. **Standalone** mode, which the rest of this documentation section covers, runs the agentgateway proxy from a configuration file that you manage yourself. **Kubernetes** mode adds a control plane that manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API. Kubernetes mode is therefore not a standalone installation method, and it has its own documentation section.

For a comparison of the two modes, see [Standalone vs. Kubernetes modes]({{< link-hextra path="/about/introduction/#standalone-vs-kubernetes-modes" >}}).

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Kubernetes mode docs" icon="external-link" description="Install the agentgateway control plane and configure it with Gateway API-compatible custom resources." >}}
{{< /cards >}}
