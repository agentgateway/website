Invoice-grade attribution means that the value that names a request reaches the cloud provider's own billing records. Finance then slices the same numbers that the provider charges. Agentgateway can also compute per-team spend from token counts and a price list, but that number is an estimate rather than the invoice. For the reasoning behind the term, see [Invoice-grade attribution on Amazon Bedrock with agentgateway](https://agentgateway.dev/blog/2026-08-19-invoice-grade-attribution-bedrock).

You configure the attribution values, and agentgateway resolves each one from an identity that it validated or from a static value that you assign.

> [!NOTE]
> Invoice-grade attribution depends on the provider. The provider must accept a per-request attribution value and expose that value in its billing data. Providers with no equivalent billing dimension cannot support it. For those providers, attribute usage inside agentgateway instead, such as with [virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Create the {{< reuse "agw-docs/snippets/backend.md" >}} and HTTPRoute for the LLM provider that you want to attribute, such as [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}).
3. Apply a [JWT authentication policy]({{< link-hextra path="/security/jwt/setup/" >}}) to the route, so that `jwt.*` values are available to attribution expressions.

## Amazon Bedrock

Bedrock attributes inference cost to the IAM principal that made the call. For gateway traffic, the documented pattern is a per-caller session. Agentgateway assumes an AWS Identity and Access Management (IAM) role for each request. The session name and the session tags come from the caller's identity.

The session name lands in AWS CloudTrail and in the IAM principal column of the Cost and Usage Report. The tags surface as cost allocation tags in Cost Explorer and in the Cost and Usage Report.

### Session identity and tags

Configure `assumeRole` in the `auth.aws` settings of the {{< reuse "agw-docs/snippets/backend.md" >}}. The session name is either a static `sessionName` or a `sessionNameExpression`. Each tag is either a static `value` or a CEL `expression` that agentgateway evaluates against the request.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: bedrock
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  ai:
    provider:
      bedrock:
        model: "amazon.nova-micro-v1:0"
        region: "us-east-1"
  policies:
    auth:
      aws:
        assumeRole:
          roleArn: arn:aws:iam::123456789012:role/bedrock-invoke
          sessionNameExpression: jwt.sub
          tags:
          - key: user
            expression: jwt.sub
          - key: team
            expression: request.headers["x-team"]
          - key: environment
            value: prod
EOF
```

{{% reuse "agw-docs/snippets/review-table.md" %}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#awsauth" >}}).

| Setting | Description |
|---------|-------------|
| `assumeRole.roleArn` | The role that agentgateway assumes for each request. The ambient credentials of the workload are the source credentials for AWS Security Token Service (STS), and must be allowed `sts:AssumeRole` and `sts:TagSession` on the role. |
| `assumeRole.sessionName` | A static STS `RoleSessionName`, 2 to 64 characters that match `[\w+=,.@-]`. If you do not set it, AWS generates a random name. |
| `assumeRole.sessionNameExpression` | A CEL expression that agentgateway evaluates against each request to produce the session name, such as `jwt.sub`. A per-caller session name makes callers distinguishable in CloudTrail and in the Cost and Usage Report. Set either `sessionName` or `sessionNameExpression`, not both. |
| `assumeRole.tags` | STS session tags that agentgateway passes to `AssumeRole`. Each tag has a `key` and exactly one of `value` for a static value or `expression` for a value that agentgateway computes per request. After you activate a key as a cost allocation tag, it appears in the Cost and Usage Report under `resourceTags/user:<key>`. STS allows at most 50 tags per role session, with keys up to 128 characters and values up to 256 characters. |

Agentgateway checks static values against the STS limits when the resource is accepted. Expressions are evaluated per request and fail closed. An expression that errors, or that produces an empty or invalid value, rejects the request before agentgateway calls AWS. No request reaches Bedrock unattributed.

To see the tags on the bill, activate the keys as cost allocation tags in the AWS Billing console. New keys take up to 24 hours to become available for activation. Activated tags apply to usage from that point on.

{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
### Per-request metadata

Bedrock also accepts per-call request metadata, which it records in the model invocation logs rather than on the bill. Session tags are bound per session and surface only as aggregated billing data. Request metadata is recorded per call, so it is where per-prompt attribution lives. You can query it in CloudWatch Logs Insights or Amazon Athena.

Bedrock does not require request metadata. A request that omits it still succeeds, and Bedrock records whatever the caller sends. Setting the metadata at the gateway is what makes it mandatory.

Set the metadata with a `finalTransformations` entry in an {{< reuse "agw-docs/snippets/policy.md" >}} that targets the route. Agentgateway applies a final transformation after it converts the request to the provider format. On the Converse API that Bedrock chat routes use, the field is `requestMetadata`.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: bedrock-request-metadata
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: bedrock
  backend:
    ai:
      finalTransformations:
      - field: requestMetadata
        expression: |
          coalesce(
            llmRequest.requestMetadata.merge({"user": jwt.sub, "team": request.headers["x-team"]}),
            {"user": jwt.sub, "team": request.headers["x-team"]}
          )
EOF
```

Callers can send their own metadata in the `x-bedrock-metadata` header, so two postures are available:

- **Merge**, as in the previous example. Your keys win on conflict, and caller keys that you did not claim survive. The `coalesce` call is required, because `.merge` errors when the caller sent no metadata and the field is absent from the converted request. The `coalesce` call then falls through to the literal.
- **Replace**. Your values are the only ones that reach Bedrock, and any caller metadata is dropped. Use an expression of `{"user": jwt.sub, "team": request.headers["x-team"]}` instead of the `coalesce` call.

> [!IMPORTANT]
> A final transformation fails open, unlike a session tag. In a final transformation, `llmRequest` is the **converted** request body, not the request that the client sent. An expression that fails to evaluate removes the target field instead of setting it, and the request still reaches the provider. A mistyped field name therefore drops attribution silently, and it also drops any metadata that the caller sent. For more information, see [Transform requests]({{< link-hextra path="/llm/transformations/" >}}).

Bedrock records request metadata only when model invocation logging is enabled in the region. Bedrock allows at most 16 entries, with keys and values up to 256 characters in a restricted character set. Bedrock rejects values outside those limits at request time.

A final transformation sets fields on the converted request body, which covers the Converse API that chat routes use. The `InvokeModel` family, such as embeddings and passthrough, takes metadata as a signed header instead, which this transformation does not set.

## Google Vertex AI

On Vertex AI, agentgateway sets billing labels on the native `generateContent` request, and those labels reach the Google Cloud billing export. Without a transformation, the labels on the request are whatever the caller sent. The transformation is what makes them yours.

Create the {{< reuse "agw-docs/snippets/backend.md" >}} and HTTPRoute for [Google Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}) first. Then configure the labels with a `finalTransformations` entry in an {{< reuse "agw-docs/snippets/policy.md" >}} that targets the Vertex AI route. The same merge and replace postures apply, because callers can send their own `labels`.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: vertex-labels
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: vertex
  backend:
    ai:
      finalTransformations:
      - field: labels
        expression: |
          coalesce(
            llmRequest.labels.merge({"tenant": jwt.sub, "cost_center": "platform"}),
            {"tenant": jwt.sub, "cost_center": "platform"}
          )
EOF
```

To replace caller labels instead of merging them, use an expression of `{"tenant": jwt.sub, "cost_center": "platform"}`.

Google allows up to 64 labels per request, with keys and values up to 63 characters from a restricted character set. Vertex AI rejects values outside those limits at request time. Billing export rows carry the labels next to the cost. You can group the export by `labels.tenant` or by any other key that you set.
{{% /version %}}

## Choose attribution values

Where the value comes from decides what the bill is worth in a dispute.

- `jwt.*` values come from a token that agentgateway validated under a JWT authentication policy. The value is a fact about who logged in, checked on every request.
- Static values are the ones that you assign to the backend or route. Use them for callers that do not log in, such as batch jobs and internal services.
- `request.headers[...]` is the caller's word. Use it only for dimensions that the caller is trusted to assert, such as an environment name. Never use it for the identity that chargeback depends on.

Keep the values low-cardinality on the bill. Every distinct set of session tags is its own STS session and its own set of line items in the Cost and Usage Report. Tag by team and cost center everywhere, and tag per user only where the chargeback question needs it.

{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
Per-prompt detail belongs in request metadata and the invocation logs, not in session tags.
{{% /version %}}

## Verify

{{% version include-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
1. Open AWS CloudTrail and filter the event history by the event name `Converse` or `InvokeModel`.
2. Open an event and confirm that `userIdentity.arn` ends with the session name that agentgateway resolved for the caller. One shared name for every request means that attribution is not working.

   ```console
   arn:aws:sts::123456789012:assumed-role/bedrock-invoke/alice@example.com
   ```

3. In the AWS Billing console, confirm that the tag keys are activated as cost allocation tags. Then open Cost Explorer, filter by the Bedrock service, and group by one of the tag keys.
{{% /version %}}
{{% version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x,2.2.x" %}}
{{< tabs >}}
{{% tab name="Amazon Bedrock" %}}
1. Open AWS CloudTrail and filter the event history by the event name `Converse` or `InvokeModel`.
2. Open an event and confirm that `userIdentity.arn` ends with the session name that agentgateway resolved for the caller. One shared name for every request means that attribution is not working.

   ```console
   arn:aws:sts::123456789012:assumed-role/bedrock-invoke/alice@example.com
   ```

3. In the AWS Billing console, confirm that the tag keys are activated as cost allocation tags. Then open Cost Explorer, filter by the Bedrock service, and group by one of the tag keys.
4. Query the Bedrock model invocation logs in CloudWatch Logs Insights and confirm that each record carries `requestMetadata` with the keys that you set.

   ```
   fields @timestamp, requestMetadata.user, requestMetadata.team
   | sort @timestamp desc
   | limit 20
   ```
{{% /tab %}}
{{% tab name="Google Vertex AI" %}}
1. Confirm that [Cloud Billing data export to BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) is enabled for the billing account.
2. Query the detailed usage cost table and confirm that the label keys that you set appear next to the Vertex AI cost. Billing export rows appear within a few hours of the request.

   ```sql
   SELECT labels.value AS tenant, SUM(cost) AS cost
   FROM `PROJECT.DATASET.gcp_billing_export_resource_v1_BILLING_ACCOUNT_ID`,
     UNNEST(labels) AS labels
   WHERE service.description = 'Vertex AI'
     AND labels.key = 'tenant'
   GROUP BY tenant
   ORDER BY cost DESC
   ```
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}

## Learn more

- [Transform requests]({{< link-hextra path="/llm/transformations/" >}}) for request transformations and the CEL context.
- [Virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) to attribute usage inside agentgateway.
- [Amazon Bedrock]({{< link-hextra path="/llm/providers/bedrock/" >}}) provider configuration.
