---
title: Google Model Armor
weight: 30
description: Apply Google Cloud Model Armor templates to sanitize LLM requests and responses.
---

[Google Cloud Model Armor](https://cloud.google.com/security/products/model-armor) lets you create safety templates in the Google Cloud console and apply them to LLM traffic. Model Armor sanitizes both user prompts and model responses against your configured policies, blocking content that violates your templates.

Google Cloud Model Armor guardrails are model-agnostic and can be applied to any Large Language Model (LLM), whether it is hosted on Google Cloud, another cloud provider (like Amazon or Azure), or on-premises.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Log in to Google Cloud console with Application Default Credentials.
   ```sh
   gcloud auth application-default login
   ```

3. Create a Model Armor template in the [Google Cloud console](https://console.cloud.google.com/security/model-armor). For more information, see the [Google Cloud documentation](https://docs.cloud.google.com/model-armor/overview). 
4. Note the template ID, project ID, and the region where the template is deployed. Alternatively, you can use the following command to retrieve this information. 
   ```sh
   gcloud model-armor templates list --location=<location>
   ```

## Configure Google Model Armor

Configure the `guardrails` field under `llm.models[]` in your agentgateway configuration. You can apply Model Armor to the `request` phase, the `response` phase, or both.

```yaml
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gemini-1.5-flash
      apiKey: "$GOOGLE_API_KEY"
    guardrails:
      request:
      - googleModelArmor:
          templateId: <your-template-id>
          projectId: <your-project-id>
          location: <location>
          policies:
            backendAuth:
              gcp: {}
      response:
      - googleModelArmor:
          templateId: <your-template-id>
          projectId: <your-project-id>
          location: <location>
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

## Test the guardrail

```sh
curl "localhost:4000/v1beta/openai/chat/completions" -H content-type:application/json  -d '{
  "model": "",
  "messages": [
   {"role": "user", "content": "I want to harm myself"}
 ]
}'
```

Example output: 
```console
The request was rejected due to inappropriate content%  
```

