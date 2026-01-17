---
title: HashiCorp Vault
weight: 10
description: Integrate Agent Gateway with HashiCorp Vault for secrets management
---

[HashiCorp Vault](https://www.vaultproject.io/) is a secrets management platform. Use it to securely store and access LLM API keys.

## Why use Vault with Agent Gateway?

- **Dynamic secrets** - Rotate API keys automatically
- **Access control** - Fine-grained policies for secret access
- **Audit logging** - Track all secret access
- **Encryption as a service** - Encrypt sensitive data

## Kubernetes integration

Use the Vault Agent Injector to inject secrets into Agent Gateway pods:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentgateway
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "agentgateway"
        vault.hashicorp.com/agent-inject-secret-openai: "secret/data/llm/openai"
        vault.hashicorp.com/agent-inject-template-openai: |
          {{- with secret "secret/data/llm/openai" -}}
          export OPENAI_API_KEY="{{ .Data.data.api_key }}"
          {{- end }}
    spec:
      serviceAccountName: agentgateway
      containers:
      - name: agentgateway
        image: ghcr.io/agentgateway/agentgateway:latest
        command: ["/bin/sh", "-c"]
        args:
          - source /vault/secrets/openai && agentgateway -f /etc/agentgateway/config.yaml
```

## Vault setup

1. Enable the KV secrets engine:
```bash
vault secrets enable -path=secret kv-v2
```

2. Store LLM API keys:
```bash
vault kv put secret/llm/openai api_key="sk-..."
vault kv put secret/llm/anthropic api_key="sk-ant-..."
```

3. Create a policy:
```hcl
path "secret/data/llm/*" {
  capabilities = ["read"]
}
```

4. Create a Kubernetes auth role:
```bash
vault write auth/kubernetes/role/agentgateway \
  bound_service_account_names=agentgateway \
  bound_service_account_namespaces=default \
  policies=llm-secrets \
  ttl=1h
```

## External Secrets Operator

Alternatively, use [External Secrets Operator](https://external-secrets.io/):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: llm-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: llm-credentials
  data:
  - secretKey: openai-key
    remoteRef:
      key: secret/data/llm/openai
      property: api_key
```

## Learn more

- [Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [External Secrets Operator](https://external-secrets.io/)
