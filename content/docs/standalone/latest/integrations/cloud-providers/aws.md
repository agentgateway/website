---
title: AWS
weight: 10
description: Run agentgateway on AWS and reach Amazon Bedrock with an IAM role instead of an API key.
aliases:
  - ../platforms/aws/
---

Run agentgateway on Amazon ECS or Amazon EKS, and reach [Amazon Bedrock]({{< link-hextra path="/integrations/llm/providers/bedrock/" >}}) with the IAM role that AWS already gives the container. No API key goes into your configuration file.

## Authenticate with an IAM role

On ECS and EKS, AWS supplies credentials to the container through the task role or the pod's service account. Agentgateway signs Bedrock requests with SigV4 using those ambient credentials. Set `auth.aws` to an empty object to use them.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-east-1
    auth:
      aws: {}
```

Review the following table to understand this configuration.

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `bedrock` for Amazon Bedrock. |
| `params.awsRegion` | The AWS region to send Bedrock requests to. |
| `auth.aws` | AWS authentication. An empty object uses the credentials that the environment already provides, such as an ECS task role, an EC2 instance profile, or `AWS_*` environment variables. |

For the full list of Bedrock settings, including passthrough and token counting, see [Amazon Bedrock]({{< link-hextra path="/integrations/llm/providers/bedrock/" >}}).

## Run on Amazon ECS

Run agentgateway as an ECS service on Fargate or EC2. The container needs three things: the image, a configuration file, and a task role.

The following task definition mounts an EFS file system at `/config` and points agentgateway at the file on it. Replace the file system ID, the role ARNs, and the region with your own values.

```json
{
  "family": "agentgateway",
  "networkMode": "awsvpc",
  "taskRoleArn": "arn:aws:iam::123456789012:role/agentgateway-task",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "volumes": [
    {
      "name": "config",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-0123456789abcdef0",
        "transitEncryption": "ENABLED"
      }
    }
  ],
  "containerDefinitions": [
    {
      "name": "agentgateway",
      "image": "cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}}",
      "command": ["-f", "/config/config.yaml"],
      "portMappings": [
        {"containerPort": 4000, "protocol": "tcp"}
      ],
      "mountPoints": [
        {"sourceVolume": "config", "containerPath": "/config"}
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
  ]
}
```

Note the following details.

* **Port 4000 carries LLM traffic.** When your configuration file defines no gateway, the implied `default` gateway serves LLM traffic on port `4000` and MCP traffic on port `3000`. Publish the port that carries the traffic you route. For more information, see [Configuration modes]({{< link-hextra path="/documentation/llm/configuration-modes/" >}}).
* **The task role is the credential.** Because `auth.aws` uses ambient credentials, `taskRoleArn` is what lets agentgateway call Bedrock. No API key is needed in the task definition or in the configuration file.
* **Pin the image tag.** The example pins the tag for this documentation version rather than using `latest`, so that a new release does not change the running proxy without your involvement.

> [!IMPORTANT]
> Do not publish the admin address from an ECS task. The admin address has no authentication, and an ECS service is usually reachable from a load balancer. To reach the UI, serve it on a gateway instead, where you can attach an authentication policy. For more information, see [Serve the UI on a gateway]({{< link-hextra path="/documentation/setup/ui/gateway-ui/" >}}).

If the EFS volume is mounted read-only, or you bake the configuration file into your own image, set `config.storage.mode` to `readOnly` so that writes from the UI fail with a clear message instead of a filesystem error. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

## Run on Amazon EKS

EKS is an ordinary Kubernetes distribution as far as agentgateway is concerned. Two options are available.

* Run standalone agentgateway as a Deployment with the [Helm chart]({{< link-hextra path="/documentation/setup/install/helm/" >}}). Attach the IAM role to the pod's service account with IAM Roles for Service Accounts (IRSA) or EKS Pod Identity, and the same `auth.aws: {}` configuration applies.
* Run the [Kubernetes control plane]({{< link-hextra path="/documentation/setup/install/kubernetes/" >}}), which manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API.

{{< cards >}}
  {{< card link="https://agentgateway.dev/docs/kubernetes/" title="Kubernetes mode docs" icon="external-link" >}}
{{< /cards >}}

## IAM permissions

Attach a policy such as the following to the task role or the IRSA role. Narrow the `Resource` values to the models and secrets that you actually use.

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

The `secretsmanager` statement is needed only if you also route to a non-AWS provider whose API key you store in Secrets Manager.

## AWS services

| Service | How it is used |
|-------------|---------|
| [Amazon Bedrock]({{< link-hextra path="/integrations/llm/providers/bedrock/" >}}) | Claude, Llama, and other foundation models, reached with the task role |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) | Storage for the API keys of non-AWS providers |
| AWS Application Load Balancer | Load balancing and TLS termination in front of the gateway port |
| Amazon CloudWatch | Destination for the container logs configured by `awslogs` |
| AWS X-Ray | Trace collection, through an [OpenTelemetry]({{< link-hextra path="/documentation/observability/traces/configs/otel/" >}}) collector |

## Next steps

* [Amazon Bedrock]({{< link-hextra path="/integrations/llm/providers/bedrock/" >}}) for the full provider reference.
* [Set up the UI]({{< link-hextra path="/documentation/setup/ui/" >}}) to serve the web interface on a gateway.
* [Choose where configuration is stored]({{< link-hextra path="/documentation/setup/storage/" >}}) before you mount a read-only file.
