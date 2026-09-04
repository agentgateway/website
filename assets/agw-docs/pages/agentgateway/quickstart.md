Use the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane to deploy and manage the lifecycle of agentgateway proxies on Kubernetes. </br></br>

{{< reuse "agw-docs/snippets/agentgateway/about.md" >}}

## Before you begin

These quickstart steps assume that you have a Kubernetes cluster, `kubectl`, and `helm` already set up. For quick testing, you can use [Kind](https://kind.sigs.k8s.io/).

```sh
kind create cluster
```

## Install

The following steps get you started with a basic installation.

{{< reuse "agw-docs/snippets/agentgateway/get-started.md" >}}

Good job! You now have the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane running in your cluster.

## Next steps

{{< icon "agentgateway" >}} [Create an agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}) that you can use for Model Context Protocol (MCP), agent-to-agent (A2A), large language model (LLM), and more AI-related use cases. For example, you can follow the [guide]({{< link-hextra path="/documentation/mcp/static-mcp/" >}}) to use agentgateway to proxy traffic to a sample MCP tool server. The example deploys a sample MCP server with a `fetch` tool, exposes the tool with agentgateway, and tests the tool with the MCP Inspector UI.

For other examples, see the [LLM consumption]({{< link-hextra path="/documentation/llm/" >}}), [inference routing]({{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,2.2.x" >}}{{< link-hextra path="/documentation/inference/" >}}{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,2.2.x" >}}{{< link-hextra path="/documentation/llm/inference/" >}}{{< /version >}}), [MCP]({{< link-hextra path="/documentation/mcp/" >}}), or [agent connectivity]({{< link-hextra path="/documentation/agent/" >}}) guides. 

## Cleanup

No longer need {{< reuse "/agw-docs/snippets/kgateway.md" >}}? Uninstall with the following command:

```sh
helm uninstall {{< reuse "/agw-docs/snippets/helm-agentgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-agentgateway-crds.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
