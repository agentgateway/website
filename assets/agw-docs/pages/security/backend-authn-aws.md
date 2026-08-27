Sign requests to an AWS service with AWS Signature Version 4, optionally through an assumed IAM role.

## About

The `aws` backend authentication method signs each request that the gateway forwards with AWS Signature Version 4. Unlike the other methods, it does not add a bearer token. It computes a signature over the request and writes the AWS authentication headers, so the method runs last, after every other policy that changes the request.

The method has two forms.

* **Implicit.** You omit `secretRef` and the gateway uses the standard AWS credential chain, which on EKS means the IAM role of the service account of the gateway. No secret is stored in the cluster, so this is the recommended form.
* **Explicit.** You name a Secret that holds an access key.

Either form can assume an IAM role before it signs, with `assumeRole`.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

You also need an AWS service to call, and an identity that is allowed to call it.

## Configure AWS backend authentication

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

{{< tabs >}}
{{% tab name="Implicit credentials" %}}
Omit `secretRef`, and the gateway uses the credentials of its own environment. On EKS, annotate the service account of the gateway for an IAM role and the gateway picks the role up automatically.

```yaml
auth:
  aws:
    region: us-east-1
    serviceName: bedrock
```
{{% /tab %}}
{{% tab name="Access key from a Secret" %}}
Point at a Secret that holds an access key. The default resolver reads the `accessKey` and `secretKey` keys, and the `sessionToken` key when the credentials are temporary.

```yaml
auth:
  aws:
    secretRef:
      name: aws-creds
    region: us-west-2
    serviceName: execute-api
```
{{% /tab %}}
{{% tab name="Assumed role" %}}
Assume an IAM role before signing. The ambient credentials of the gateway become the source credentials for the AWS Security Token Service (STS) call.

```yaml
auth:
  aws:
    region: us-east-1
    serviceName: bedrock
    assumeRole:
      roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
      sessionName: agentgateway
```
{{% /tab %}}
{{< /tabs >}}

| Field | Description |
| -- | -- |
| `aws.secretRef` | Secret in the policy namespace that holds the credentials under the `accessKey` and `secretKey` keys, plus `sessionToken` for temporary credentials. Omit the field to use the credential chain of the environment. Cannot be combined with `assumeRole`. |
| `aws.region` | Signing region, such as `us-east-1`. Set the field when the target service is in a different region from the gateway. A typed AWS backend may supply the region on its own. |
| `aws.serviceName` | Signing service name, such as `bedrock`, `bedrock-agentcore`, or `execute-api`. A typed AWS backend may supply the name on its own. |
| `aws.assumeRole` | IAM role to assume before signing. Cannot be combined with `secretRef`. |

## Assume a role

The `assumeRole` field calls STS with the ambient credentials of the gateway, and signs with the credentials that STS returns. The gateway caches the assumed credentials and refreshes them before they expire. Concurrent requests that need the same credentials share one STS call.

The optional session name and session tags exist for cost attribution. Both accept either a static value or a CEL expression that the gateway evaluates against each request, which lets one gateway attribute cost per user or per team.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: aws-backend-auth
  namespace: httpbin
spec:
  targetRefs:
  - group: {{< reuse "agw-docs/snippets/group.md" >}}
    kind: {{< reuse "agw-docs/snippets/backend.md" >}}
    name: my-bedrock-backend
  backend:
    auth:
      aws:
        region: us-east-1
        serviceName: bedrock
        assumeRole:
          roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
          sessionNameExpression: jwt.sub
          tags:
          - key: team
            value: platform
          - key: user
            expression: jwt.sub
EOF
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `assumeRole.roleArn` | Required ARN of the IAM role to assume. |
| `assumeRole.sessionName` | Static session name (`RoleSessionName`), which appears in AWS CloudTrail and in the Cost and Usage Report. Two to 64 characters, matching `[\w+=,.@-]`. Omit the field and AWS generates a random name. |
| `assumeRole.sessionNameExpression` | CEL expression that the gateway evaluates against each request to produce the session name, such as `jwt.sub`. Cannot be combined with `sessionName`. |
| `assumeRole.tags` | Session tags that the gateway passes to STS. Each tag sets `key`, plus exactly one of `value` for a static value or `expression` for a CEL expression. STS allows at most 50 tags for one role session. |

> [!NOTE]
> A session tag reaches the Cost and Usage Report as `resourceTags/user:<TagKey>`, but only after you activate the tag key as a cost allocation tag in the AWS Billing console. Until you do, the tag is attached to the session and does not appear in any report.

> [!WARNING]
> A CEL expression that does not produce a valid session name or tag value at request time causes the gateway to reject that request. An expression such as `jwt.sub` therefore makes the route depend on a client authentication policy that populates the JWT claims. Test the expression before you rely on it, because the failure is per-request and not visible in the policy status.

## How the gateway resolves an implicit credential

When you omit `secretRef`, the gateway uses the default credential chain of the AWS SDK. The chain tries the following sources in order and stops at the first one that returns credentials.

1. **Environment variables:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.
2. **Shared configuration files:** `~/.aws/config` and `~/.aws/credentials`.
3. **Web identity token:** `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`. This is the source that IAM roles for service accounts and EKS Pod Identity use, and it is the one to expect in a cluster.
4. **Container credentials:** the credential endpoint that Amazon ECS and other container hosts provide.
5. **Instance metadata:** IMDSv2 on an EC2 instance.

When you also set `assumeRole`, the credentials from this chain are the source credentials for the STS call rather than the credentials that sign the request.

## Troubleshoot

| Symptom | Cause |
| -- | -- |
| The API server rejects the policy with `secretRef and assumeRole are mutually exclusive`. | Assumed credentials always come from the environment. Remove `secretRef`, and give the ambient identity permission to assume the role. |
| The API server rejects the policy with `exactly one of value or expression must be set`. | A session tag sets both `value` and `expression`, or neither. |
| The API server rejects the policy with `at most one of the fields in [sessionName sessionNameExpression] may be set`. | The policy sets both session name fields. Choose the static field or the expression field. |
| The backend returns a signature mismatch. | The signing region or service name does not match the service that the gateway called. Set `region` and `serviceName` explicitly. A signature also breaks when a policy changes the request after it is signed, so check for a transformation policy on the same route. |
| Requests fail with no region. | Nothing supplied a region: the backend is not a typed AWS backend, `region` is unset, and the environment has no ambient region. Set `region`. |

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} aws-backend-auth -n httpbin
```
