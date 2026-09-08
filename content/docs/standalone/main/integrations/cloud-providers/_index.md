---
title: Cloud providers
weight: 10
description: Run agentgateway on AWS, Google Cloud, or Azure, and authenticate to each provider's managed model services.
test: skip
aliases:
  - /docs/standalone/main/integrations/platforms/
---

Agentgateway runs the same proxy and reads the same configuration file on every cloud provider, so none of the [installation methods]({{< link-hextra path="/documentation/setup/install/" >}}) change when you move to a cloud. What changes is the surrounding environment: which container runtime starts the process, how the process gets an identity, and where its configuration file comes from.

The guides in this section cover those provider-specific parts. Each guide shows the agentgateway configuration that uses the provider's own identity system, so that agentgateway reaches the provider's managed model service without an API key in your configuration file.

| Provider | Container runtimes | Identity for model access |
| --- | --- | --- |
| [AWS]({{< link-hextra path="/integrations/cloud-providers/aws/" >}}) | Amazon ECS, Amazon EKS | IAM task role or instance profile, signed with SigV4 |
| [Google Cloud]({{< link-hextra path="/integrations/cloud-providers/gcp/" >}}) | Cloud Run, GKE | Service account, through Application Default Credentials |
| [Azure]({{< link-hextra path="/integrations/cloud-providers/azure/" >}}) | Azure Container Apps, AKS | Managed identity or workload identity, through Entra ID |

## Kubernetes on a cloud provider

Amazon EKS, GKE, and AKS are ordinary Kubernetes distributions as far as agentgateway is concerned. Two options are available on all three.

* Run standalone agentgateway as a Kubernetes Deployment with the [Helm chart]({{< link-hextra path="/documentation/setup/install/helm/" >}}). Your configuration file is the source of truth, rendered into a ConfigMap.
* Run the [Kubernetes control plane]({{< link-hextra path="/documentation/setup/install/kubernetes/" >}}) instead, which manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API.

The identity configuration in each cloud provider guide applies to both options.
