---
title: AWS
weight: 10
description: Run agentgateway on AWS and reach Amazon Bedrock with an IAM role instead of an API key.
test:
  aws:
  - file: ${versionRoot}/integrations/cloud-providers/aws.md
    path: aws
aliases:
  - /docs/standalone/main/integrations/platforms/aws/
---

Run agentgateway on Amazon ECS or Amazon EKS, and reach [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}) with the IAM role that AWS already gives the container. No API key goes into your configuration file.

{{< doc-test paths="aws" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Authenticate with an IAM role": the example config is accepted by
#     agentgateway (--validate-only), so `auth.aws: {}` is a recognized shape
#     alongside `provider: bedrock` and `params.awsRegion`.
#   * With that config loaded, agentgateway serves LLM traffic on port 4000 and
#     resolves the model to the Bedrock provider in the configured region. This
#     is what makes the port numbers in the ECS task definition and the Cloud
#     Run-style examples on this page checkable rather than asserted.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That SigV4 signing with a task role reaches Bedrock - external dependency;
#     the test has no AWS account, no task role, and a live call bills a
#     completion.
#   * "Run on Amazon ECS" - external dependency; the task definition needs an
#     ECS cluster, an EFS file system, and IAM roles that the test cannot stand
#     up. The container image, port, and command in it match the configuration
#     that this test does run.
#   * "IAM permissions" - a different layer; the policy document is evaluated by
#     AWS, not by agentgateway.
#   * "AWS services" - display-only table of links.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

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

{{< doc-test paths="aws" >}}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-east-1
    auth:
      aws: {}
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

Review the following table to understand this configuration.

| Setting | Description |
|---------|-------------|
| `name` | The model name to match in incoming requests. Use `*` to match any model name. |
| `provider` | The LLM provider, set to `bedrock` for Amazon Bedrock. |
| `params.awsRegion` | The AWS region to send Bedrock requests to. |
| `auth.aws` | AWS authentication. An empty object uses the credentials that the environment already provides, such as an ECS task role, an EC2 instance profile, or `AWS_*` environment variables. |

{{< doc-test paths="aws" >}}
# Confirm that agentgateway serves LLM traffic on port 4000, which the ECS task
# definition on this page publishes, and that params.awsRegion reaches the
# resolved Bedrock provider as the settings table describes.
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3

SERVED=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -r '[.data[].id] | index("*") // "missing"')
if [ "$SERVED" = "missing" ]; then
  echo "FAIL: the wildcard model from the example config is not served on port 4000"
  exit 1
fi
RESOLVED=$(curl -sf --max-time 10 http://localhost:15000/config_dump | jq -r '
  [ .backends[].backend.ai
    | select(. != null)
    | .target.providers[].active[].endpoint.provider.bedrock.region
  ] | first')
if [ "$RESOLVED" != "us-east-1" ]; then
  echo "FAIL: expected Bedrock region us-east-1 but agentgateway resolved $RESOLVED"
  exit 1
fi
echo "✓ Port 4000 serves the model and the Bedrock region resolves to the documented value"
{{< /doc-test >}}

For the full list of Bedrock settings, including passthrough and token counting, see [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}).

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

* **Port 4000 carries LLM traffic.** When your configuration file defines no gateway, the implied `default` gateway serves LLM traffic on port `4000` and MCP traffic on port `3000`. Publish the port that carries the traffic you route. For more information, see [Configuration modes]({{< link-hextra path="/llm/configuration-modes/" >}}).
* **The task role is the credential.** Because `auth.aws` uses ambient credentials, `taskRoleArn` is what lets agentgateway call Bedrock. No API key is needed in the task definition or in the configuration file.
* **Pin the image tag.** The example pins the tag for this documentation version rather than using `latest`, so that a new release does not change the running proxy without your involvement.

> [!IMPORTANT]
> Do not publish the admin address from an ECS task. The admin address has no authentication, and an ECS service is usually reachable from a load balancer. To reach the admin UI, serve it on a gateway instead, where you can attach an authentication policy. For more information, see [Serve the UI on a gateway]({{< link-hextra path="/setup/ui/gateway-ui/" >}}).

If the EFS volume is mounted read-only, or you bake the configuration file into your own image, set `config.storage.mode` to `readOnly` so that writes from the admin UI fail with a clear message instead of a filesystem error. For more information, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

## Run on Amazon EKS

EKS is an ordinary Kubernetes distribution as far as agentgateway is concerned. Two options are available.

* Run standalone agentgateway as a Deployment with the [Helm chart]({{< link-hextra path="/setup/install/helm/" >}}). Attach the IAM role to the pod's service account with IAM Roles for Service Accounts (IRSA) or EKS Pod Identity, and the same `auth.aws: {}` configuration applies.
* Run the [Kubernetes control plane]({{< link-hextra path="/setup/install/kubernetes/" >}}), which manages agentgateway proxies from Kubernetes custom resources and the Kubernetes Gateway API.

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
| [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}) | Claude, Llama, and other foundation models, reached with the task role |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) | Storage for the API keys of non-AWS providers |
| AWS Application Load Balancer | Load balancing and TLS termination in front of the gateway port |
| Amazon CloudWatch | Destination for the container logs configured by `awslogs` |
| AWS X-Ray | Trace collection, through an [OpenTelemetry]({{< link-hextra path="/integrations/observability/opentelemetry/" >}}) collector |

## Next steps

* [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}) for the full provider reference.
* [Set up the admin UI]({{< link-hextra path="/setup/ui/" >}}) to serve the web interface on a gateway.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}) before you mount a read-only file.
