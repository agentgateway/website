---
title: AWS Bedrock Guardrails
weight: 20
description: Apply AWS Bedrock Guardrails to filter LLM requests and responses for policy-violating content.
---

[AWS Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) let you define content policies in the AWS console and apply them to LLM traffic passing through agentgateway. When a request or response violates a guardrail policy, agentgateway blocks the interaction and returns an error.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Create a guardrail in the [AWS console](https://console.aws.amazon.com/bedrock/home#/guardrails) or via the AWS CLI.
3. Retrieve your guardrail identifier by running: `aws bedrock list-guardrails --region <aws-region>`
4. Authenticate with AWS Bedrock using the standard [AWS authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html). Make sure that you have permission to invoke the Bedrock Guardrails API.

## Configure Bedrock Guardrails

Configure `guardrails` on a model in your agentgateway configuration. You can apply guardrails to the `request` phase, the `response` phase, or both.

```yaml
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-west-2
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
| `policies.backendAuth.aws` | AWS authentication configuration. Agentgateway uses the credentials available in the environment, such as environment variables or an instance profile. |

When a request or response matches a guardrail policy, agentgateway blocks the interaction and returns an error such as: `The request was rejected due to inappropriate content`.
