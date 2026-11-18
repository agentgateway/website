Install the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane and get agentgateway running in your cluster. {{< reuse "agw-docs/snippets/agentgateway/about.md" >}}

## Before you begin

Set up the following prerequisites.

* A Kubernetes cluster. For quick testing, you can use [Kind](https://kind.sigs.k8s.io/).
* [`kubectl`](https://kubernetes.io/docs/tasks/tools/), to manage the cluster.
* [`helm`](https://helm.sh/docs/intro/install/), to install agentgateway.
* [`jq`](https://jqlang.org/download/), to format the responses in the quick start guides that follow this one.

To create a Kind cluster, run the following command.

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
  {{< card path="/documentation/quickstart/llm" title="LLM (OpenAI)" subtitle="Route requests to OpenAI's chat completions API." >}}
  {{< card path="/documentation/quickstart/mcp" title="MCP servers" subtitle="Connect to an MCP server and try tools." >}}
  {{< card path="/documentation/quickstart/non-agentic-http" title="Non-agentic HTTP" subtitle="Route HTTP traffic to a backend such as httpbin." >}}
{{< /cards >}}

## Cleanup

No longer need {{< reuse "/agw-docs/snippets/kgateway.md" >}}? Uninstall with the following command:

```sh
helm uninstall {{< reuse "agw-docs/snippets/helm-agentgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-agentgateway-crds.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
