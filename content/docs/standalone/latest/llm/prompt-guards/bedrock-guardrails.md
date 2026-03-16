---
title: AWS Bedrock Guardrails
weight: 20
description: Apply AWS Bedrock Guardrails to filter LLM requests and responses for policy-violating content.
---

[AWS Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) let you define content policies in the AWS console and apply them to LLM traffic passing through the agentgateway prxoy. When a request or response violates a guardrail policy, agentgateway blocks the interaction and returns an error.

AWS Bedrock Guardrails are model-agnostic and can be applied to any Large Language Model (LLM), whether it is hosted on AWS Bedrock, another cloud provider (like Google or Azure), or on-premises.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Create a guardrail in the [AWS console](https://console.aws.amazon.com/bedrock/home#/guardrails) or via the AWS CLI.
3. Retrieve your guardrail identifier by running: `aws bedrock list-guardrails --region <aws-region>`
4. Authenticate with AWS Bedrock using the standard [AWS authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html). Make sure that you have permission to invoke the Bedrock Guardrails API.

## Configure Bedrock Guardrails

Configure the `guardrails` field under `llm.models[]` in your agentgateway configuration. You can apply guardrails to the `request` phase, the `response` phase, or both.

```yaml
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: amazon.titan-text-express-v1
      apiKey: "$BEDROCK_API_KEY"
    guardrails:
      request:
      - bedrockGuardrails:
          guardrailIdentifier: <your-guardrail-id>
          guardrailVersion: DRAFT
          region: us-west-2
          policies:
            backendAuth:
              aws: {}
      response:
      - bedrockGuardrails:
          guardrailIdentifier: <your-guardrail-id>
          guardrailVersion: DRAFT
          region: us-west-2
          policies:
            backendAuth:
              aws: {}
EOF
```

| Setting | Description |
| -- | -- |
| `guardrailIdentifier` | The identifier of the Bedrock guardrail to apply. Retrieve this by running `aws bedrock list-guardrails`. |
| `guardrailVersion` | The version of the guardrail. Use `DRAFT` for development or a specific version number for production. |
| `region` | The AWS region where the guardrail is configured, such as `us-west-2`. |
| `policies.backendAuth.aws` | AWS authentication configuration. Agentgateway uses the credentials available in the environment, such as environment variables or an instance profile.  |

When a request or response matches a guardrail policy, agentgateway blocks the interaction and returns an error such as: `The request was rejected due to inappropriate content`.
