---
title: AWS Bedrock Guardrails
weight: 20
description: Apply AWS Bedrock Guardrails to filter LLM requests and responses for policy-violating content.
---

[AWS Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) provide content filtering, PII detection, topic restrictions, and word filters. You must create the guardrail policies in the AWS console and then apply them to LLM route that you want to protect. When a request or response violates a guardrail policy, the agentgateway proxy blocks the interaction and returns an error.

AWS Bedrock Guardrails are model-agnostic and can be applied to any Large Language Model (LLM), whether it is hosted on AWS Bedrock, another cloud provider (like Google or Azure), or on-premises.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Set up AWS Bedrock guardrails

1. Create a guardrail in the [AWS console](https://console.aws.amazon.com/bedrock/home#/guardrails) or via the AWS CLI.
2. Retrieve your guardrail identifier and version. For more information, see the [AWS documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-components.html).
   ```sh
   aws bedrock list-guardrails --region <aws-region>
   ```

   Example output: 
   ```console
   {
    "guardrails": [
        {
            "id": "a1aaaa11aa1a",
            "arn": "arn:aws:bedrock:us-west-2:11111111111:guardrail/a1aaaa11aa1a",
            "status": "READY",
            "name": "my-guardrail",
            "description": "Testing agentgateway bedrock guardrail integration ",
            "version": "DRAFT",
            "createdAt": "2026-02-09T17:59:29+00:00",
            "updatedAt": "2026-02-09T18:01:29.567223+00:00"
        }
    ]
   }
   ```

3. Create a Kubernetes secret with your AWS credentials. Make sure that you have permission to invoke the Bedrock Guardrails API.
   ```sh
   kubectl create secret generic aws-secret \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=accessKey="$AWS_ACCESS_KEY_ID" \
     --from-literal=secretKey="$AWS_SECRET_ACCESS_KEY" \
     --from-literal=sessionToken="$AWS_SESSION_TOKEN" \
     --type=Opaque \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

4. Configure the prompt guard. Add the ID, version, and region of your guardrail. 
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: bedrock-prompt-guard
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
     backend:
       ai:
         promptGuard:
           request:
           - bedrockGuardrails:
               identifier: <guardrail-ID>
               version: "<version>" 
               region: <region>
               policies:
                 auth:
                   aws: 
                     secretRef:
                       name: aws-secret
           response:
           - bedrockGuardrails:
               identifier: <guardrail-ID>
               version: "<version>" 
               region: <region>
               policies:
                 auth:
                   aws: 
                     secretRef:
                       name: aws-secret
   EOF
   ```

   {{< callout type="info" >}}
   The `aws: {}` configuration uses the default AWS credential chain (IAM role, environment variables, or instance profile). For authentication details, see the [AWS authentication documentation](https://docs.aws.amazon.com/sdk-for-go/api/aws/session/).
   {{< /callout >}}

   The `policies` field supports more than the `aws` credential source shown here. You can choose a different authentication method or tune the connection that agentgateway opens to Bedrock, such as setting a request timeout or custom TLS. For all the options, see [Backend connection and authentication policies](#backend-connection-and-authentication-policies).


5. Test the guardrail. The following commands assume that you set up your guardrail to block requests that contain email information. 
   {{< tabs >}}
   {{% tab name="OpenAI v1/chat/completions" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json  -d '{
    "model": "",
    "messages": [
      {
        "role": "user",
        "content": "My email is test@solo.io"
      }
    ]
   }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json  -d '{
    "model": "",
    "messages": [
      {
        "role": "user",
        "content": "My email is test@solo.io"
      }
    ]
   }' | jq
   ```
   {{% /tab %}}
   {{% tab name="Custom route" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json  -d '{
    "model": "",
    "messages": [
      {
        "role": "user",
        "content": "My email is test@solo.io"
      }
    ]
   }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/openai" -H content-type:application/json  -d '{
    "model": "",
    "messages": [
      {
        "role": "user",
        "content": "My email is test@solo.io"
      }
    ]
   }' | jq
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   ```console
   The request was rejected due to inappropriate content
   ```

## Backend connection and authentication policies

The `policies` field configures how agentgateway connects and authenticates to the AWS Bedrock Guardrails service when it evaluates a request or response.

### Authentication

Under `policies.auth`, set one credential source (`aws`, `secretRef`, or `key`). Optionally, set `location` to control where the credential is placed.

| Method | Description |
| -- | -- |
| `aws` | Authenticate with AWS credentials. Set `aws: {}` to use the default AWS credential chain (IAM role, environment variables, or instance profile), or set `aws.secretRef` to read credentials from a Kubernetes secret. |
| `secretRef` | Read the API key from a Kubernetes secret. By default, the key that matches the credential location is used, such as `Authorization` for the default header location. To use a different key, set `secretRef.key`. |
| `key` | Send an inline API key in the `Authorization` header. This option is the least secure. Use a secret instead when possible. |
| `location` | Where to place the credential. Defaults to the `Authorization` header with a `Bearer` prefix. To change it, set a `header`, `queryParameter`, or `cookie`. |

### Backend connection settings

You can also tune the connection that agentgateway opens to the Bedrock Guardrails backend by setting the following `BackendConnectionPolicy` fields under `policies`.

| Setting | Description |
| -- | -- |
| `tls` | TLS settings for the connection, such as a custom CA certificate or SNI. |
| `http` | HTTP settings, such as the `requestTimeout` and HTTP protocol `version`. |
| `tcp` | TCP connection settings. |
| `tunnel` | Tunnel settings, such as an `HTTPS_PROXY`, used to reach the backend. |

For example, the following prompt guard authenticates with a secret and sets a request timeout for the calls to Bedrock.

```yaml
- bedrockGuardrails:
    identifier: <guardrail-ID>
    version: "<version>"
    region: <region>
    policies:
      auth:
        aws:
          secretRef:
            name: aws-secret
      http:
        requestTimeout: 5s
```

For the full set of fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} bedrock-prompt-guard -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
kubectl delete secret aws-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```
    
