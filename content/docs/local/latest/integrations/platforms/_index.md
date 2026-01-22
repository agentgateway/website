---
title: Platforms
weight: 80
description: Deploy Agent Gateway on various platforms and cloud providers
---

Agent Gateway runs anywhere—from local development to production cloud environments.

## Deployment Options

{{< cards >}}
  {{< card link="kubernetes" title="Kubernetes" subtitle="EKS, GKE, AKS, OpenShift, kind, minikube, and more" >}}
  {{< card link="docker" title="Docker" subtitle="Container deployment" >}}
  {{< card link="aws" title="AWS" subtitle="ECS, Lambda, and AWS services" >}}
  {{< card link="gcp" title="Google Cloud" subtitle="Cloud Run and GCP services" >}}
  {{< card link="azure" title="Azure" subtitle="Container Apps and Azure services" >}}
{{< /cards >}}

## Kubernetes distributions

Agent Gateway runs on all Kubernetes distributions through [kgateway](https://kgateway.dev/docs/agentgateway/):

| Category | Distributions |
|----------|---------------|
| **Cloud-managed** | Amazon EKS, Google GKE, Azure AKS, DigitalOcean, Linode, IBM Cloud, Oracle OKE, Alibaba ACK |
| **On-premises** | Red Hat OpenShift, Rancher RKE/RKE2, VMware Tanzu, Canonical MicroK8s, K3s, vanilla Kubernetes |
| **Local development** | kind, minikube, Docker Desktop, Rancher Desktop, k3d |

{{< cards >}}
  {{< card link="kubernetes" title="View all Kubernetes distributions" subtitle="Detailed setup guides for each platform" >}}
{{< /cards >}}

## Choosing a deployment model

| Platform | Best for | Key features |
|----------|----------|--------------|
| **Kubernetes** | Production workloads | Gateway API, auto-scaling, MCP service discovery, CRD configuration |
| **Docker** | Development, small deployments | Simple setup, Docker Compose support |
| **AWS** | AWS-native workloads | ECS, Bedrock integration, Secrets Manager |
| **GCP** | Google Cloud workloads | Cloud Run, Vertex AI integration, Secret Manager |
| **Azure** | Azure workloads | Container Apps, Azure OpenAI integration, Key Vault |

## Learn more

- [Deployment Guide](/docs/deployment/)
- [Configuration Reference](/docs/configuration/)
- [kgateway Documentation](https://kgateway.dev/docs/agentgateway/)
