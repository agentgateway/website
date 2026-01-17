---
title: Azure Key Vault
weight: 40
description: Integrate Agent Gateway with Azure Key Vault
---

[Azure Key Vault](https://azure.microsoft.com/en-us/products/key-vault) safeguards secrets, keys, and certificates. Use it to store LLM API keys for Agent Gateway on Azure.

## Store secrets

```bash
az keyvault secret set --vault-name my-vault --name openai-api-key --value "sk-..."
az keyvault secret set --vault-name my-vault --name anthropic-api-key --value "sk-ant-..."
```

## Kubernetes integration

Use Azure Workload Identity and the Secrets Store CSI Driver:

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: llm-secrets
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "false"
    clientID: "<workload-identity-client-id>"
    keyvaultName: "my-vault"
    objects: |
      array:
        - |
          objectName: openai-api-key
          objectType: secret
    tenantId: "<tenant-id>"
  secretObjects:
  - secretName: llm-credentials
    type: Opaque
    data:
    - objectName: openai-api-key
      key: OPENAI_API_KEY
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentgateway
spec:
  template:
    metadata:
      labels:
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: agentgateway
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
    name: azure-key-vault
    kind: ClusterSecretStore
  target:
    name: llm-credentials
  data:
  - secretKey: OPENAI_API_KEY
    remoteRef:
      key: openai-api-key
```

## Learn more

- [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)
- [Secrets Store CSI Driver](https://secrets-store-csi-driver.sigs.k8s.io/)
