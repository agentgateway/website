---
title: Invoice-grade attribution
weight: 15
description: Carry a validated caller identity into AWS and Google Cloud billing records, so LLM spend is attributed per team, app, user, or any chosen attribution value on the provider's own bill.
test: skip
---

Attribution is invoice-grade when the value that names a request survives all the way into the cloud provider's own billing records, so the numbers finance slices are the numbers the provider actually bills. This page configures that for Amazon Bedrock and Google Vertex AI. For the reasoning behind the term, see [Invoice-grade attribution on Amazon Bedrock with agentgateway](https://agentgateway.dev/blog/2026-08-19-invoice-grade-attribution-bedrock).

A gateway sees every request and can compute what each team spent from token counts and a price list. It is worth disclosing that this number is merely an estimate: it is the gateway's arithmetic, and the invoice is the provider's. When the attribution value that agentgateway resolves rides the request into the provider's billing records, the bill itself is broken down by team, app, user, or the attribution value you choose, and finance reconciles against the number the provider charges.

The values the operator configures are resolved at the gateway from an identity it validated, or assigned outright, and a caller cannot override them. How much a caller can influence depends on the layer. STS session tags ride the credential exchange: the keys are always the operator's and a caller cannot add or remove one, while a value is whatever the operator's expression resolves, which may deliberately read a caller header such as `request.headers["x-team"]`. Vertex labels and Bedrock request metadata ride the request, so there the operator chooses between merging caller-sent keys and replacing them.

> [!NOTE]
> Each cloud carries attribution differently. On Amazon Bedrock, the value rides the credentials for the upstream call as STS session tags and the role session name, and per-request metadata lands in the model invocation logs. On Google Vertex AI, the value rides the request as billing labels. The mechanisms do not overlap; configure each provider you use.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Amazon Bedrock

Bedrock attributes inference cost to the IAM principal that made the call. For traffic through a gateway, the documented pattern is a per-caller session: agentgateway assumes a role for each request, with a session name and session tags derived from the caller's identity. The session name lands in AWS CloudTrail and in the Cost and Usage Report's IAM principal column; the tags surface as cost allocation tags in Cost Explorer and the Cost and Usage Report.

### Session identity and tags

Configure `auth.aws.assumeRole` on the model. Each tag, and the session name, is either a static `value` or a CEL `expression` evaluated against the request.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  policies:
    jwtAuth:
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-east-1
    auth:
      aws:
        assumeRole:
          roleArn: arn:aws:iam::123456789012:role/bedrock-invoke
          sessionName:
            expression: jwt.sub
          tags:
          - key: user
            expression: jwt.sub
          - key: team
            expression: request.headers["x-team"]
          - key: environment
            value: prod
```

| Setting | Description |
|---------|-------------|
| `roleArn` | The role agentgateway assumes for each request. The credentials in agentgateway's environment must be allowed `sts:AssumeRole` and `sts:TagSession` on it. |
| `sessionName` | The STS `RoleSessionName`, a static string or `{expression: ...}`. A per-caller session name makes callers distinguishable in CloudTrail and in the Cost and Usage Report. If unset, the AWS SDK generates a random name. Up to 64 characters matching `[\w+=,.@-]`. |
| `tags` | STS session tags passed to `AssumeRole`. Each tag is `{key, value}` for a static value or `{key, expression}` for a value computed per request. Once a key is activated as a cost allocation tag, it appears in the Cost and Usage Report under `resourceTags/user:<key>`. |

Static values are validated against STS limits at startup. Expressions are evaluated per request and fail closed: an expression that errors, or produces an empty or invalid value, rejects the request before any call to AWS is made, so no request reaches Bedrock unattributed.

To see the tags on the bill, activate the keys as cost allocation tags in the AWS Billing console. New keys take up to 24 hours to appear for activation, and activated tags apply to usage from that point on.

### Per-request metadata

Bedrock also accepts per-call request metadata, recorded in the model invocation logs rather than on the bill. Session tags are bound per session and surface only as aggregated billing data; request metadata is recorded per call, so it is where per-prompt attribution lives, queryable in CloudWatch Logs Insights or Amazon Athena. Bedrock does not enforce it: a request that omits it succeeds, and the provider records whatever the caller sends. Setting it at the gateway is what makes it mandatory.

Set it with a `finalTransformation` on the converted request. The converted Bedrock request is available to the expression as `llmRequest`; on the Converse API the field is `requestMetadata`.

```yaml
llm:
  models:
  - name: "*"
    provider: bedrock
    params:
      awsRegion: us-east-1
    finalTransformation:
      requestMetadata: >-
        coalesce(
          llmRequest.requestMetadata.merge({"user": jwt.sub, "team": request.headers["x-team"]}),
          {"user": jwt.sub, "team": request.headers["x-team"]}
        )
```

Two postures are available, because callers may send their own metadata through the `x-bedrock-metadata` header:

- **Merge** (above): the operator's keys win on conflict, and caller keys the operator did not claim survive. `coalesce` is required: `.merge` errors when the caller sent no metadata and the field is absent from the converted request, and `coalesce` then falls through to the literal. Without it, those requests would be forwarded without metadata, because a transformation whose expression errors leaves the field untouched.
- **Replace**: `requestMetadata: {"user": jwt.sub, "team": request.headers["x-team"]}` sets the operator's values and drops any caller metadata.

Request metadata is recorded only when model invocation logging is enabled in the region. Bedrock allows at most 16 entries, with keys and values up to 256 characters in a restricted character set; values outside those limits are rejected by Bedrock at request time. `finalTransformation` sets fields on the converted request body, which covers the Converse API used for chat routes; the `InvokeModel` family (embeddings, passthrough) takes metadata as a signed header instead, which this transformation does not set.

## Google Vertex AI

On Vertex AI the attribution value rides the native `generateContent` request as billing labels, which land in the Google Cloud billing export. Without a transformation, the labels on the request are whatever the caller sent, and the transformation is what makes them operator-set. Configure the labels with a `finalTransformation` on the model; the same merge and replace postures apply, and callers may send their own `labels`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  policies:
    jwtAuth:
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
  models:
  - name: "*"
    provider: vertex
    params:
      vertexProject: my-project
      vertexRegion: us-east5
    finalTransformation:
      labels: >-
        coalesce(
          llmRequest.labels.merge({"tenant": jwt.sub, "cost_center": "platform"}),
          {"tenant": jwt.sub, "cost_center": "platform"}
        )
```

Google allows up to 64 labels per request, with keys and values up to 63 characters from a restricted character set. Values outside those limits are rejected by Vertex AI at request time. Billing export rows carry the labels next to the cost, so the export can be grouped by `labels.tenant` or any other key you set.

## Choose attribution values

Where the value comes from decides what the bill is worth in a dispute.

- `jwt.*` values come from a token agentgateway validated under `jwtAuth`. The value is a fact about who logged in, checked on every request.
- Static values are assigned by the operator to the model or route, for callers that do not log in, such as batch jobs and internal services.
- `request.headers[...]` is the caller's word. Use it only for dimensions the caller is trusted to assert, such as an environment name, never for the identity that chargeback depends on.

Keep the values low-cardinality on the bill. Every distinct session tag set is its own STS session and its own line items in the Cost and Usage Report, so tag by team and cost center everywhere, and per user only where the chargeback question needs it. Per-prompt detail belongs in request metadata and the invocation logs, not in tags.

## Verify

- **AWS CloudTrail**: filter by event name `Converse` or `InvokeModel`. `userIdentity.arn` ends with the session name resolved for the caller, not one shared name for every request through the gateway.
- **Bedrock model invocation logs**: each record carries `requestMetadata` with the keys you set.
- **AWS Cost Explorer**: after the tag keys are activated, group Bedrock cost by any of them.
- **Google Cloud billing export**: rows carry `labels.<key>` next to the Vertex AI cost.

## Learn more

- [Transform requests]({{< link-hextra path="/llm/transformations/" >}}) for request transformations and the CEL context.
- [Virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) to attribute usage inside agentgateway.
- [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}) provider configuration.
