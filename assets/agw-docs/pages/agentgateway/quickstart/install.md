Install the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane and get agentgateway running in your cluster. {{< reuse "agw-docs/snippets/agentgateway/about.md" >}}

## Before you begin

These steps assume that you have a Kubernetes cluster, `kubectl`, and `helm` already set up. For quick testing, you can use [Kind](https://kind.sigs.k8s.io/).

```sh
kind create cluster
```

## Install

The following steps get you started with a basic installation. For detailed instructions, see the [installation guides]({{< link-hextra path="/reference/helm" >}}).

{{< reuse "agw-docs/snippets/agentgateway/get-started.md" >}}

Good job! You now have the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane running in your cluster.

## Set up an agentgateway proxy

{{< reuse "agw-docs/snippets/agentgateway-setup.md" >}}

## Next steps

Choose a quick start to route traffic with agentgateway:

{{< cards >}}
  {{< card link="../llm" title="LLM (OpenAI)" subtitle="Route requests to OpenAI's chat completions API." >}}
  {{< card link="../mcp" title="MCP servers" subtitle="Connect to an MCP server and try tools." >}}
  {{< card link="../non-agentic-http" title="Non-agentic HTTP" subtitle="Route HTTP traffic to a backend such as httpbin." >}}
{{< /cards >}}

## Cleanup

No longer need {{< reuse "/agw-docs/snippets/kgateway.md" >}}? Uninstall with the following command:

```sh
helm uninstall {{< reuse "agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
