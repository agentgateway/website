---
title: Secret Management
weight: 60
description: Integrate Agent Gateway with secret management systems
---

Agent Gateway can retrieve API keys and credentials from external secret management systems.

{{< cards >}}
  {{< card link="vault" title="HashiCorp Vault" subtitle="Secrets management" >}}
  {{< card link="aws-secrets-manager" title="AWS Secrets Manager" subtitle="AWS secret storage" >}}
  {{< card link="gcp-secret-manager" title="GCP Secret Manager" subtitle="Google Cloud secrets" >}}
  {{< card link="azure-key-vault" title="Azure Key Vault" subtitle="Azure secret storage" >}}
{{< /cards >}}

## Environment variables

The simplest approach is using environment variables:

```yaml
policies:
  backendAuth:
    key: "$OPENAI_API_KEY"  # References OPENAI_API_KEY env var
```

For Kubernetes, use Secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: llm-credentials
type: Opaque
stringData:
  openai-key: sk-...
  anthropic-key: sk-ant-...
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: agentgateway
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-credentials
              key: openai-key
```
