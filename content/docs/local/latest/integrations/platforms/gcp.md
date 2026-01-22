---
title: Google Cloud
weight: 40
description: Deploy Agent Gateway on Google Cloud Platform
---

Run Agent Gateway on GCP to leverage Vertex AI, GKE, and Google Cloud services.

## Deployment options

### Google Kubernetes Engine (GKE)

For GKE deployments, use [kgateway](https://kgateway.dev/docs/agentgateway/) which provides native Kubernetes Gateway API support, dynamic configuration, and MCP service discovery.

{{< cards >}}
  {{< card link="https://kgateway.dev/docs/agentgateway/" title="Deploy on GKE with kgateway" icon="external-link" >}}
{{< /cards >}}

### Cloud Run

Run Agent Gateway as a serverless container on Cloud Run.

```bash
gcloud run deploy agentgateway \
  --image ghcr.io/agentgateway/agentgateway:latest \
  --port 3000 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=my-project" \
  --service-account agentgateway@my-project.iam.gserviceaccount.com \
  --allow-unauthenticated
```

## GCP integrations

| Integration | Purpose |
|-------------|---------|
| [Vertex AI](/docs/llm/providers/vertex/) | Access Gemini and other models |
| [Google Gemini](/docs/llm/providers/gemini/) | Direct Gemini API access |
| [GCP Secret Manager](/docs/integrations/secrets/gcp-secret-manager/) | Secure API key storage |
| Cloud Load Balancing | Global load balancing with SSL |
| Cloud Trace | Distributed tracing |
| Cloud Monitoring | Metrics and alerting |

## IAM permissions

Create a service account with these roles:

```bash
# Create service account
gcloud iam service-accounts create agentgateway \
  --display-name "Agent Gateway"

# Grant Vertex AI access
gcloud projects add-iam-policy-binding my-project \
  --member "serviceAccount:agentgateway@my-project.iam.gserviceaccount.com" \
  --role "roles/aiplatform.user"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding my-project \
  --member "serviceAccount:agentgateway@my-project.iam.gserviceaccount.com" \
  --role "roles/secretmanager.secretAccessor"
```

## Learn more

- [Vertex AI Provider](/docs/llm/providers/vertex/)
- [Google Gemini Provider](/docs/llm/providers/gemini/)
- [GCP Secret Manager Integration](/docs/integrations/secrets/gcp-secret-manager/)
- [Deployment Guide](/docs/deployment/)
