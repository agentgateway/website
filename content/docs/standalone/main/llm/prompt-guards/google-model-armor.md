---
title: Google Model Armor
weight: 30
description: Apply Google Cloud Model Armor templates to sanitize LLM requests and responses.
---

[Google Cloud Model Armor](https://cloud.google.com/security/products/model-armor) lets you create safety templates in the Google Cloud console and apply them to LLM traffic. Model Armor sanitizes both user prompts and model responses against your configured policies, blocking content that violates your templates.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Create a Model Armor template in the [Google Cloud console](https://console.cloud.google.com/security/model-armor).
3. Note the template ID, project ID, and the region where the template is deployed.
4. Ensure your agentgateway has GCP credentials configured with permission to call the Model Armor API.

## Configure Google Model Armor

Configure the `promptGuard` policy under `policies.ai` in your agentgateway configuration. You can apply Model Armor to the `request` phase, the `response` phase, or both.

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
       - ai:
          name: gemini
          provider:
            openAI:
              model: gemini-1.5-flash
      policies:
        backendAuth:
          key: "$GOOGLE_API_KEY"
        ai:
          promptGuard:
            request:
            - googleModelArmor:
                templateId: <your-template-id>
                projectId: <your-project-id>
                location: us-central1
                policies:
                  backendAuth:
                    gcp: {}
            response:
            - googleModelArmor:
                templateId: <your-template-id>
                projectId: <your-project-id>
                location: us-central1
                policies:
                  backendAuth:
                    gcp: {}
EOF
```

| Setting | Description |
| -- | -- |
| `templateId` | The identifier of the Model Armor template to apply. Find this in the Google Cloud console under **Security** > **Model Armor**. |
| `projectId` | The Google Cloud project ID where the Model Armor template is configured. |
| `location` | The region where the Model Armor template is deployed. Defaults to `us-central1`. |
| `policies.backendAuth.gcp` | GCP authentication configuration. Agentgateway uses the credentials available in the environment, such as Application Default Credentials. |

When a request or response matches a Model Armor policy, agentgateway blocks the interaction and returns an error to the caller.
