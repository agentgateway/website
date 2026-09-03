## About

The `aws` backend authentication method signs each request that the gateway forwards with AWS Signature Version 4. Unlike the other methods, it does not add a bearer token. It computes a signature over the request and writes the AWS authentication headers, so the method runs last, after every other policy that changes the request.

Which credentials sign the request depends on the fields that you set. The method has two forms.

* **Implicit.** You omit `secretRef` and the gateway uses the standard AWS credential chain. On EKS, that chain resolves to the Identity and Access Management (IAM) role of the service account of the gateway. No secret is stored in the cluster, so this is the recommended form.
* **Explicit.** You set `secretRef` to name a Secret that holds an access key. Use this form when the gateway does not run on AWS, or when the ambient identity is not the one that the backend expects.

Both forms set the signing region and the service name the same way. On top of the implicit form, you can also set `assumeRole` to assume an IAM role before the gateway signs. `assumeRole` cannot be combined with `secretRef`, because the source credentials for the AWS Security Token Service (STS) call always come from the environment of the gateway.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

You also need an AWS service to call, and an identity that is allowed to call it.

## Use implicit credentials

Omit both `secretRef` and `assumeRole`, and the gateway signs with the credentials of its own environment. On EKS, annotate the service account of the gateway for an IAM role and the gateway picks the role up automatically.

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

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
EOF
```

The policy names no credential source at all, and that absence is what makes the credentials implicit. The two fields that the policy does set describe the request that the gateway signs, not the identity that signs it.

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `aws.region` | Signing region, such as `us-east-1`. Set the field when the target service is in a different region from the gateway. If you omit it, a typed AWS backend may supply the region. Otherwise the gateway uses the ambient AWS region. |
| `aws.serviceName` | Signing service name, such as `bedrock`, `bedrock-agentcore`, or `execute-api`. Those three are examples and not the full set. The field takes any AWS SigV4 signing name, and the gateway does not validate it against a list. The signing name is the service element of the credential scope, which the AWS [Signature Version 4 signing elements](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-signing-elements.html) documentation describes. A typed AWS backend may supply the name on its own. |

### How the gateway resolves an implicit credential

The gateway uses the default credential chain of the AWS SDK. The chain tries the following sources in order and stops at the first one that returns credentials.

1. **Environment variables:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.
2. **Shared configuration files:** `~/.aws/config` and `~/.aws/credentials`.
3. **Web identity token:** `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`. This is the source that IAM roles for service accounts and EKS Pod Identity use, and it is the one to expect in a cluster.
4. **Container credentials:** the credential endpoint that Amazon ECS and other container hosts provide.
5. **Instance metadata:** IMDSv2 on an EC2 instance.

When you also set `assumeRole`, the credentials from this chain become the source credentials for the STS call. They no longer sign the request themselves.

## Use an explicit access key from a Secret

Point at a Secret that holds an access key. Use this form when the gateway does not run on AWS, or when it must sign as an identity other than its own.

{{< reuse "agw-docs/snippets/aws-creds.md" >}}

1. Save the access key of the identity that you want the gateway to sign as. Set a session token only for temporary credentials, such as the output of an STS call. Long-lived IAM user keys do not use one.

   ```sh
   export AGW_AWS_ACCESS_KEY_ID="<access-key>"
   export AGW_AWS_SECRET_ACCESS_KEY="<secret-key>"
   export AGW_AWS_SESSION_TOKEN=""
   ```

2. Create a Secret that holds the credentials under the keys that the default resolver reads: `accessKey`, `secretKey`, and `sessionToken`. Leave `sessionToken` empty for long-lived keys, because the resolver treats it as optional.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: aws-creds
     namespace: httpbin
   type: Opaque
   stringData:
     accessKey: ${AGW_AWS_ACCESS_KEY_ID}
     secretKey: ${AGW_AWS_SECRET_ACCESS_KEY}
     sessionToken: "${AGW_AWS_SESSION_TOKEN}"
   EOF
   ```

3. Create a policy that points at the Secret.

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
       name: my-api-gateway-backend
     backend:
       auth:
         aws:
           secretRef:
             name: aws-creds
           region: us-west-2
           serviceName: execute-api
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Description |
   | -- | -- |
   | `aws.secretRef` | Secret in the policy namespace that holds the credentials. The default resolver reads the `accessKey` and `secretKey` keys, plus `sessionToken` for temporary credentials. Omit the field to use the credential chain of the environment. Cannot be combined with `assumeRole`. |
   | `aws.region` and `aws.serviceName` | The same signing fields that the implicit form takes. See the table in [Use implicit credentials](#use-implicit-credentials). |

## Assume an IAM role

The `assumeRole` field calls STS with the ambient credentials of the gateway, and signs with the credentials that STS returns. The gateway caches the assumed credentials and refreshes them before they expire. Concurrent requests that need the same credentials share one STS call.

Create the IAM role in AWS before you set the field. The role needs a permissions policy that allows the actions of the service that you call, such as `bedrock:InvokeModel` for Amazon Bedrock. It also needs a trust policy that allows the ambient identity of the gateway to assume it. Which permissions you attach therefore depends on the service that the backend fronts. For the steps, see [Create a role to delegate permissions to an AWS service](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-service.html) in the AWS documentation.

The optional session name and session tags exist for cost attribution. Both accept either a static value or a Common Expression Language (CEL) expression that the gateway evaluates against each request. One gateway can therefore attribute cost per user or per team.

> [!WARNING]
> A CEL expression that does not produce a valid session name or tag value at request time causes the gateway to reject that request. An expression such as `jwt.sub` therefore makes the route depend on a client authentication policy that populates the JWT claims. Test the expression before you rely on it, because the failure is per-request and not visible in the policy status.

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
kubectl delete secret aws-creds -n httpbin --ignore-not-found
```
