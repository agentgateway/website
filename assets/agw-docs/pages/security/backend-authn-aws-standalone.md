## Configuration examples

To sign requests to an AWS service, use `aws`. Unlike the other methods, `aws` does not attach a token. It computes an AWS Signature Version 4 signature over the request, so it runs last, after every other policy that changes the request.

Name an access key explicitly, or omit the credential fields to use the standard AWS credential chain.

```yaml
backendAuth:
  aws:
    accessKeyId: "$AWS_ACCESS_KEY_ID"
    secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
    sessionToken: "$AWS_SESSION_TOKEN"
    region: us-west-2
    serviceName: execute-api
```

```yaml
backendAuth:
  aws:
    region: us-east-1
    serviceName: bedrock
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `accessKeyId` and `secretAccessKey` | An explicit access key. Set both together, or omit both to use the credential chain. |
| `sessionToken` | Session token that goes with a temporary access key. |
| `region` | Signing region, such as `us-east-1`. Set the field when the target service is in a different region from agentgateway. A typed AWS backend may supply the region on its own. |
| `serviceName` | Signing service name, such as `bedrock`, `bedrock-agentcore`, or `execute-api`. The field can be any AWS SigV4 signing name, and agentgateway does not validate it against a list. The signing name is the service element of the credential scope, which the AWS [Signature Version 4 signing elements](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv4-signing-elements.html) documentation describes. A typed AWS backend may supply the name on its own. |
| `assumeRole` | IAM role to assume before signing. Available with the credential chain only, so do not set an access key alongside it. |

### AWS credential resolution order

When you omit `accessKeyId` and `secretAccessKey`, agentgateway uses the [default credential chain](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) of the AWS SDK. The chain tries the following sources in order and stops at the first one that returns credentials.

1. **Environment variables:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.
2. **Shared configuration files:** `~/.aws/config` and `~/.aws/credentials`.
3. **Web identity token:** `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`. This is the source that IAM roles for service accounts and EKS Pod Identity use.
4. **Container credentials:** the credential endpoint that Amazon ECS and other container hosts provide.
5. **Instance metadata:** IMDSv2 on an EC2 instance.

### Assume a role

To sign with a role rather than with the identity of agentgateway, set `assumeRole`. Agentgateway calls the AWS Security Token Service (STS) with the credentials from the chain, and signs with the credentials that STS returns. It caches the assumed credentials and refreshes them before they expire.

Create the IAM role in AWS before you set the field. The role needs a permissions policy that allows the actions of the service that you call, such as `bedrock:InvokeModel` for Amazon Bedrock. It also needs a trust policy that allows the identity of agentgateway to assume it. Which permissions you attach therefore depends on the service that the backend fronts. For the steps, see [Create a role to delegate permissions to an AWS service](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-service.html) in the AWS documentation.

The session name and the session tags exist for cost attribution. Each accepts a static value, or a CEL expression that agentgateway evaluates against every request, which lets one gateway attribute cost per user or per team.

```yaml
backendAuth:
  aws:
    region: us-east-1
    serviceName: bedrock
    assumeRole:
      roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
      sessionName:
        expression: jwt.sub
      tags:
      - key: team
        value: platform
      - key: user
        expression: jwt.sub
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `assumeRole.roleArn` | Required ARN of the IAM role to assume. |
| `assumeRole.sessionName` | Session name (`RoleSessionName`) that appears in AWS CloudTrail and in the Cost and Usage Report. Either a static string, or `{expression: <cel>}`. Two to 64 characters, matching `[\w+=,.@-]`. Omit the field and AWS generates a random name. |
| `assumeRole.tags` | Session tags that agentgateway passes to STS. Each tag sets `key`, plus exactly one of `value` for a static value or `expression` for a CEL expression. STS allows at most 50 tags for one role session. |

> [!NOTE]
> A session tag reaches the Cost and Usage Report as `resourceTags/user:<TagKey>`, but only after you activate the tag key as a cost allocation tag in the AWS Billing console.

> [!WARNING]
> A CEL expression that does not produce a valid session name or tag value at request time causes agentgateway to reject that request. An expression such as `jwt.sub` therefore makes the route depend on a client authentication policy that populates the JWT claims. The failure is per-request, and `--validate-only` does not catch it.

{{< doc-test paths="backend-authn-aws" >}}
# WHAT THIS TEST VALIDATES:
#   * Every aws fragment above is accepted once wrapped in the gateways/routes
#     scaffolding that the page tells the reader to add: an explicit access key,
#     the implicit form, and assumeRole with both a static and a CEL session
#     name plus static and CEL tags.
#   * A session tag really does require exactly one of value and expression.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That any credential signs a request AWS accepts -- external dependency:
#     needs a real account, an IAM role, and a service to call.
#   * The credential resolution order -- external dependency: exercising a rung
#     means supplying the credential it looks for, on the host type it looks on.
#   * The Cost and Usage Report behavior of session tags -- different layer: the
#     tag is sent to STS, and the report is a billing artifact that appears hours
#     later, only after the tag key is activated in the console.
#   * The per-request rejection when a CEL expression yields an invalid session
#     name -- requires traffic the page omits: it needs a client authentication
#     policy populating jwt claims, and a live STS call.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-AKIAIOSFODNN7EXAMPLE}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-dummy}"
export AWS_SESSION_TOKEN="${AWS_SESSION_TOKEN:-dummy}"
{{< /doc-test >}}

{{< doc-test paths="backend-authn-aws" >}}
aws_case() {
  local name="$1" expect="$2"
  { cat <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: bedrock-runtime.us-east-1.amazonaws.com:443
    policies:
      backendAuth:
EOF
    sed 's/^/        /'
  } > "config-aws-$name.yaml"
  if agentgateway -f "config-aws-$name.yaml" --validate-only > "aws-$name.log" 2>&1; then
    [ "$expect" = ok ] || { echo "FAIL: $name was accepted but should be rejected"; exit 1; }
    echo "ok       $name"
  else
    [ "$expect" = fail ] || { echo "FAIL: $name was rejected"; cat "aws-$name.log"; exit 1; }
    echo "rejected $name (as expected)"
  fi
}

aws_case explicit ok <<'EOF'
aws:
  accessKeyId: "$AWS_ACCESS_KEY_ID"
  secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
  sessionToken: "$AWS_SESSION_TOKEN"
  region: us-west-2
  serviceName: execute-api
EOF

aws_case implicit ok <<'EOF'
aws:
  region: us-east-1
  serviceName: bedrock
EOF

aws_case assume-role ok <<'EOF'
aws:
  region: us-east-1
  serviceName: bedrock
  assumeRole:
    roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
    sessionName: agentgateway
EOF

aws_case assume-role-cel ok <<'EOF'
aws:
  region: us-east-1
  serviceName: bedrock
  assumeRole:
    roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
    sessionName:
      expression: jwt.sub
    tags:
    - key: team
      value: platform
    - key: user
      expression: jwt.sub
EOF

# A tag sets exactly one of value and expression.
aws_case tag-both fail <<'EOF'
aws:
  assumeRole:
    roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
    tags:
    - key: team
      value: platform
      expression: jwt.sub
EOF

echo "aws standalone backend authentication verified"
{{< /doc-test >}}
