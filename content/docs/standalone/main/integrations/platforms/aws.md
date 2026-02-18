---
title: AWS
weight: 30
description: Deploy agentgateway on Amazon Web Services
---

Run agentgateway on AWS to leverage Amazon Bedrock, ECS/EKS, and other AWS services.

## Deployment options

### Amazon ECS

Run agentgateway as an ECS service with Fargate or EC2.

```json
{
  "family": "agentgateway",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "agentgateway",
      "image": "ghcr.io/agentgateway/agentgateway:latest",
      "portMappings": [
        {"containerPort": 3000, "protocol": "tcp"}
      ],
      "environment": [
        {"name": "ADMIN_ADDR", "value": "0.0.0.0:15000"}
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/agentgateway",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "agentgateway"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024"
}
```

### Amazon EKS

For EKS deployments, use [Agentgateway on Kubernetes](https://agentgateway.dev/docs/kubernetes/) which provides native Kubernetes Gateway API support, dynamic configuration, and MCP service discovery.

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Deploy on EKS with kgateway" icon="external-link" >}}
{{< /cards >}}

## AWS integrations

| Integration | Purpose |
|-------------|---------|
| [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}) | Access Claude, Llama, and other models |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) | Secure API key storage |
| AWS ALB | Load balancing with SSL termination |
| CloudWatch | Logs and metrics |
| X-Ray | Distributed tracing |

## IAM permissions

Create an IAM role for agentgateway with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*:*:model/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:llm-*"
    }
  ]
}
```

## Learn more

- [Amazon Bedrock Provider]({{< link-hextra path="/llm/providers/bedrock/" >}})
- [AWS Secrets Manager Integration](https://aws.amazon.com/secrets-manager/)
- [Deployment Guide]({{< link-hextra path="/deployment/" >}})
