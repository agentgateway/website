---
title: Custom webhooks
weight: 50
description: Integrate custom webhook servers to configure advanced content safety requirements.  
---

For advanced content safety requirements beyond regex and cloud provider services, you can integrate custom webhook servers. This allows you to use specialized ML models, proprietary detection logic, or integrate with existing security tools.

### Use cases for custom webhooks

- Named Entity Recognition (NER) for detecting person names, organizations, locations
- Industry-specific compliance rules (HIPAA, PCI-DSS, GDPR)
- Integration with existing DLP or security tools
- Custom ML models for domain-specific content detection
- Multi-step validation workflows
- Advanced contextual analysis

## Configuration

Configure a prompt guard to call your webhook service. You can use the [guardrail API](https://agentgateway.dev/docs/kubernetes/main/llm/prompt-guards/webhook/) guide to create your own guardrail webhook in Kubernetes.  

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
      response:
      - webhook:
          target:
            host: content-safety-webhook.example.com:8000
EOF
```
