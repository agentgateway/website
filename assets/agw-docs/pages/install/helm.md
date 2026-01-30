In this installation guide, you install the {{< reuse "/agw-docs/snippets/kgateway.md" >}} {{< gloss "Control Plane" >}}control plane{{< /gloss >}} in a Kubernetes cluster by using [Helm](https://helm.sh/). Helm is a popular package manager for Kubernetes configuration files. This approach is flexible for adopting to your own command line, continuous delivery, or other workflows.



As part of the control plane installation, you enable the {{< reuse "/agw-docs/snippets/agentgateway.md" >}} data plane.

## Before you begin

1. Create or use an existing Kubernetes cluster. 
2. Install the following command-line tools.
   * [`kubectl`](https://kubernetes.io/docs/tasks/tools/#kubectl), the Kubernetes command line tool. Download the `kubectl` version that is within one minor version of the Kubernetes clusters you plan to use.
   * [`helm`](https://helm.sh/docs/intro/install/), the Kubernetes package manager.

## Install

Install the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane by using Helm.

{{< reuse "agw-docs/snippets/agentgateway/helm.md" >}}

## Next steps

Now that you have the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane set up and running, check out the following guides to start using the {{< reuse "/agw-docs/snippets/agentgateway.md" >}} data plane.

- Learn more about [{{< reuse "/agw-docs/snippets/agentgateway.md" >}}, its features and benefits]({{< link-hextra path="/about/overview">}}). 
- [Set up an agentgateway proxy]({{< link-hextra path="/setup/">}}) to start routing to AI workloads.


## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

Follow the [Uninstall guide]({{< link-hextra path="/operations/uninstall">}}).

