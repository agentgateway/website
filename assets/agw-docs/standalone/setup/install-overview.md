Agentgateway runs the same proxy and reads the same configuration file in every installation method. What differs is who starts the process, where the configuration file lives, and whether that file is writable.

## Choose an installation method

Review the following table to choose the method that fits your environment.

| Method | Use it when | Configuration file |
| --- | --- | --- |
| [Binary]({{< link-hextra path="/setup/install/binary/" >}}) | You want to run agentgateway on a laptop or a virtual machine, or you are trying agentgateway for the first time. | A local file that you pass with `-f`, or one that agentgateway generates in your user config directory. Writable. |
| [Docker]({{< link-hextra path="/setup/install/docker/" >}}) | You want to run agentgateway in a Docker container without the need for a Kubernetes cluster. | A file or directory that you mount into the container. Writable, unless you mount it read-only. |
| [Helm]({{< link-hextra path="/setup/install/helm/" >}}) | You want Kubernetes to run and expose the proxy for you, but you do not want a control plane that manages the agentgateway pod for you. | A ConfigMap that Helm renders from your Helm values and mounts read-only. |

All three methods run agentgateway in standalone mode, where your configuration file is the source of truth. If you want a managed Kubernetes deployment with a control plane, Gateway API support, and dynamic Kubernetes resources instead, see [Kubernetes control plane]({{< link-hextra path="/setup/install/kubernetes/" >}}).

## Install on a cloud provider

None of the installation methods change on a cloud provider, because agentgateway runs the same proxy and reads the same configuration file everywhere. What changes is which container runtime starts the process, how the process gets an identity, and where its configuration file comes from. For those provider-specific steps, and for the configuration that reaches a provider's managed model service without an API key, see the following guides.

* [AWS]({{< link-hextra path="/integrations/cloud-providers/aws/" >}}) for Amazon ECS, Amazon EKS, and Amazon Bedrock.
* [Google Cloud]({{< link-hextra path="/integrations/cloud-providers/gcp/" >}}) for Cloud Run, GKE, and Vertex AI.
* [Azure]({{< link-hextra path="/integrations/cloud-providers/azure/" >}}) for Azure Container Apps, AKS, and Azure OpenAI.

## Guides
