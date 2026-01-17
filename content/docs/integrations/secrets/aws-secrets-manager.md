---
title: AWS Secrets Manager
weight: 20
description: Integrate Agent Gateway with AWS Secrets Manager
---

[AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) helps you manage, retrieve, and rotate secrets. Use it to store LLM API keys for Agent Gateway.

## Why use AWS Secrets Manager with Agent Gateway?

- **Automatic rotation** - Rotate secrets without downtime
- **IAM integration** - Fine-grained access control
- **Encryption** - Secrets encrypted with KMS
- **Audit** - CloudTrail logging for all access

## Store secrets

```bash
aws secretsmanager create-secret \
  --name llm/openai \
  --secret-string '{"api_key":"sk-..."}'

aws secretsmanager create-secret \
  --name llm/anthropic \
  --secret-string '{"api_key":"sk-ant-..."}'
```

## Kubernetes integration

Use the AWS Secrets and Configuration Provider (ASCP):

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: llm-secrets
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "llm/openai"
        objectType: "secretsmanager"
        jmesPath:
          - path: api_key
            objectAlias: openai-key
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
      serviceAccountName: agentgateway  # With IRSA role
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
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: llm-credentials
  data:
  - secretKey: OPENAI_API_KEY
    remoteRef:
      key: llm/openai
      property: api_key
```

## Learn more

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [Secrets Store CSI Driver](https://secrets-store-csi-driver.sigs.k8s.io/)
