---
title: Kubernetes
weight: 10
description: Deploy agentgateway on any Kubernetes distribution
---

agentgateway runs on any Kubernetes distribution through [Agentgateway on Kubernetes](https://agentgateway.dev/docs/kubernetes/), which provides native Kubernetes Gateway API support, dynamic configuration via CRDs, and MCP service discovery.

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Get Started with kgateway" icon="external-link" subtitle="Complete installation and configuration guide" >}}
{{< /cards >}}

## Supported distributions

Agentgateway works on all Kubernetes distributions, both in the cloud and on-premises.

### Cloud-managed Kubernetes

| Distribution | Provider |
|--------------|----------|
| Amazon EKS | AWS |
| Google GKE | Google Cloud |
| Azure AKS | Microsoft Azure |
| DigitalOcean Kubernetes | DigitalOcean |
| Linode Kubernetes Engine | Akamai |
| IBM Cloud Kubernetes | IBM |
| Oracle OKE | Oracle Cloud |
| Alibaba ACK | Alibaba Cloud |

### On-premises & self-managed

| Distribution | Type |
|--------------|------|
| Red Hat OpenShift | Enterprise |
| Rancher RKE/RKE2 | Enterprise |
| VMware Tanzu | Enterprise |
| Canonical MicroK8s | Lightweight |
| K3s | Lightweight |
| Vanilla Kubernetes | Self-managed |

### Local development

| Distribution | Best for |
|--------------|----------|
| kind | CI/CD, testing |
| minikube | Local development |
| Docker Desktop | macOS/Windows dev |
| Rancher Desktop | Local development |
| k3d | Local development |

## Why kgateway for Kubernetes?

| Feature | Benefit |
|---------|---------|
| **Kubernetes Gateway API** | Standard API for traffic management |
| **Gateway API Inference Extension** | Native AI/ML workload support |
| **MCP Service Discovery** | Automatic discovery of MCP servers via Kubernetes services |
| **Dynamic Configuration** | Update routing without restarts using CRDs |
| **Native Integration** | Works with Kubernetes RBAC, NetworkPolicies, and service mesh |

## Learn more

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="kgateway Documentation" icon="external-link" subtitle="Full agentgateway on Kubernetes guide" >}}
  {{< card link="https://kgateway.dev/docs/agentgateway/latest/quickstart/" title="Quick Start" icon="external-link" subtitle="Deploy agentgateway in minutes" >}}
{{< /cards >}}
