---
title: GCP Secret Manager
weight: 30
description: Integrate Agent Gateway with Google Cloud Secret Manager
---

[Google Cloud Secret Manager](https://cloud.google.com/secret-manager) provides secure storage for secrets. Use it to store LLM API keys for Agent Gateway on GCP.

## Store secrets

```bash
echo -n "sk-..." | gcloud secrets create openai-api-key --data-file=-
echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key --data-file=-
```

## Kubernetes integration

Use Workload Identity and the Secrets Store CSI Driver:

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: llm-secrets
spec:
  provider: gcp
  parameters:
    secrets: |
      - resourceName: "projects/my-project/secrets/openai-api-key/versions/latest"
        path: "openai-key"
  secretObjects:
  - secretName: llm-credentials
    type: Opaque
    data:
    - objectName: openai-key
      key: OPENAI_API_KEY
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentgateway
spec:
  template:
    spec:
      serviceAccountName: agentgateway  # With Workload Identity
      containers:
      - name: agentgateway
        image: ghcr.io/agentgateway/agentgateway:latest
        envFrom:
        - secretRef:
            name: llm-credentials
        volumeMounts:
        - name: secrets-store
          mountPath: /mnt/secrets
          readOnly: true
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: llm-secrets
```

## External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: llm-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcp-secret-manager
    kind: ClusterSecretStore
  target:
    name: llm-credentials
  data:
  - secretKey: OPENAI_API_KEY
    remoteRef:
      key: openai-api-key
```

## Learn more

- [GCP Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Secrets Store CSI Driver](https://secrets-store-csi-driver.sigs.k8s.io/)
