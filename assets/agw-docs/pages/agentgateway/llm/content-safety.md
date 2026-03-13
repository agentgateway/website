Protect LLM requests and responses from sensitive data exposure and harmful content using layered content safety controls.

## About

Content safety helps you prevent sensitive information from reaching LLM providers and block harmful content in both requests and responses. Content safety practices broadly cover a range of techniques including personally identifiable information (PII) detection, PII sanitization, data loss prevention, prompt guards, and other guardrail features.

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} provides a layered approach to content safety through prompt guards that can reject, mask, or moderate content before it reaches the LLM or returns to users.

You can layer multiple protection mechanisms to create comprehensive content safety:
- **Regex-based detection**: Fast, deterministic matching for known patterns like credit cards, SSNs, emails, and custom patterns
- **External moderation**: Leverage cloud provider guardrails for advanced content filtering
- **Custom webhooks**: Integrate your own content safety logic for specialized requirements

This guide shows you how to use each layer and combine them for defense-in-depth content protection.

### How content safety works

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} processes content safety checks in the request and response paths. You can configure multiple prompt guards that run in sequence, allowing you to combine different detection methods.

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as Agentgateway
    participant Guard as Content Safety Layer
    participant LLM

    Client->>Gateway: Send prompt
    Gateway->>Guard: 1. Regex check (fast)
    Guard-->>Gateway: Pass/Reject/Mask

    alt Passed Regex
        Gateway->>Guard: 2. External moderation (if configured)
        Guard-->>Gateway: Pass/Reject/Mask

        alt Passed Moderation
            Gateway->>Guard: 3. Custom webhook (if configured)
            Guard-->>Gateway: Pass/Reject/Mask

            alt Passed All Guards
                Gateway->>LLM: Forward sanitized request
                LLM-->>Gateway: Generate response
                Gateway->>Guard: Response guards
                Guard-->>Gateway: Pass/Reject/Mask
                Gateway-->>Client: Return sanitized response
            end
        end
    else Rejected
        Gateway-->>Client: Return rejection message
    end
```

The diagram shows content flowing through multiple guard layers. Each layer can:
- **Pass**: Allow content to proceed to the next layer
- **Reject**: Block the request and return an error message
- **Mask**: Replace sensitive patterns with placeholders and continue

### Choose the right approach

Use this table to decide which content safety layer to use for your requirements.

| Requirement | Recommended Approach | Reason |
|-------------|---------------------|--------|
| Detect known PII formats (SSN, credit cards, emails) | Regex with builtins | Fast, deterministic, no external dependencies |
| Block hate speech, violence, harmful content | External moderation (OpenAI, Bedrock) | ML-based detection trained for content safety |
| Organization-specific restricted terms | Regex with custom patterns | Simple pattern matching for known strings |
| Named entity recognition (people, orgs, places) | Custom webhook | Requires NER models not available in built-in options |
| HIPAA, PCI-DSS, or other compliance requirements | Layered approach | Combine regex + external moderation + custom validation |
| Integration with existing DLP tools | Custom webhook | Allows reuse of existing security infrastructure |
| Fastest performance with minimal latency | Regex only | No external API calls |
| Most comprehensive protection | All three layers | Defense-in-depth with multiple detection methods |

### Performance considerations

Each content safety layer adds latency to requests. Plan your configuration accordingly.

- **Regex guards**: < 1ms per check, negligible latency impact
- **External moderation**: 50-200ms depending on provider and network latency
- **Custom webhooks**: Varies based on webhook implementation and location

To optimize performance:
- Use regex for fast, deterministic checks before slower external checks
- Deploy webhook servers in the same region as the gateway
- Configure appropriate timeouts for external moderation endpoints
- Consider request size limits to avoid processing very large prompts

For webhook-specific performance tuning, see the [Guardrail Webhook optimization guide]({{< link-hextra path="/llm/guardrail-api/guardrail-guide/" >}}#optimize-performance).

{{< callout type="info" >}}
**Evaluation order**: Prompt guards are evaluated *after* rate limiting. This means that requests rejected by content safety checks (403 Forbidden) still consume rate limit quota. If you want to avoid consuming quota on blocked requests, authentication policies (JWT/OPA) are evaluated before rate limiting and can prevent quota consumption.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Layer 1: Regex-based detection

Regex-based prompt guards provide fast, deterministic pattern matching for known sensitive data formats. Use this layer for common PII patterns and custom organization-specific strings.

### Built-in patterns

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} includes built-in regex patterns for common sensitive data types:
- `CreditCard`: Credit card numbers (Visa, MasterCard, Amex, Discover)
- `Ssn`: US Social Security Numbers
- `Email`: Email addresses
- `PhoneNumber`: US phone numbers
- `CaSin`: Canadian Social Insurance Numbers

Example configuration that masks credit cards in responses:

```yaml,paths="content-safety-regex"
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: content-safety-regex
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: openai
  backend:
    ai:
      promptGuard:
        response:
        - regex:
            builtins:
            - CreditCard
            - Ssn
            - Email
            action: Mask
EOF
```

### Custom patterns

You can also define custom regex patterns for organization-specific sensitive data.

Example that rejects requests containing specific restricted terms:

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: content-safety-custom
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
        - response:
            message: "Request blocked due to policy violation"
          regex:
            action: Reject
            matches:
            - "confidential"
            - "internal-only"
            - "project-\\w+-secret"  # Custom pattern with regex
EOF
```

### Test regex guards

Send a request with a fake credit card number and verify it gets masked in the response:

{{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}

{{% tab tabName="Cloud Provider LoadBalancer" %}}
```sh
curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json -d '{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "What type of number is 5105105105105100?"
    }
  ]
}' | jq
```
{{% /tab %}}

{{% tab tabName="Port-forward for local testing" %}}
```sh
curl "localhost:8080/openai" -H content-type:application/json -d '{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "What type of number is 5105105105105100?"
    }
  ]
}' | jq
```
{{% /tab %}}

{{< /tabs >}}

Example output showing the credit card masked as `<CREDIT_CARD>`:

```json
{
  "choices": [
    {
      "message": {
        "content": "<CREDIT_CARD> is an even number."
      }
    }
  ]
}
```

{{< doc-test paths="content-safety-regex" >}}
YAMLTest -f - <<'EOF'
- name: verify credit card is masked in response
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/openai"
    method: POST
    headers:
      content-type: application/json
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [
          {
            "role": "user",
            "content": "What type of number is 5105105105105100?"
          }
        ]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.choices[0].message.content"
        comparator: contains
        value: "<CREDIT_CARD>"
EOF
{{< /doc-test >}}

## Layer 2: External moderation endpoints

External moderation endpoints use cloud provider AI services to detect harmful content, hate speech, violence, and other policy violations. These services often use ML models trained specifically for content moderation.

### OpenAI Moderation

The OpenAI Moderation API detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence.

1. Create a secret with your OpenAI API key:
   ```sh
   kubectl create secret generic openai-secret \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal="Authorization=Bearer $OPENAI_API_KEY"
   ```

2. Configure the prompt guard to use OpenAI Moderation:
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: content-safety-openai
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
           - openAIModeration:
               policies:
                 auth:
                   secretRef:
                     name: openai-secret
               model: omni-moderation-latest
             response:
               message: "Content blocked by moderation policy"
   EOF
   ```

3. Test with content that triggers moderation:
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}

   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "$INGRESS_GW_ADDRESS/openai" \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```
   {{% /tab %}}

   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i "localhost:8080/openai" \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```
   {{% /tab %}}

   {{< /tabs >}}

   Expected response:
   ```
   HTTP/1.1 403 Forbidden
   Content blocked by moderation policy
   ```

### AWS Bedrock Guardrails

AWS Bedrock Guardrails provide content filtering, PII detection, topic restrictions, and word filters. You must first create a guardrail in the AWS Bedrock console.

{{< callout type="info" >}}
For instructions on creating Bedrock Guardrails, see the [AWS Bedrock Guardrails documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions.html).
{{< /callout >}}

1. Get your guardrail identifier and version:
   ```sh
   aws bedrock list-guardrails
   ```

2. Configure the prompt guard:
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: content-safety-bedrock
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
               guardrailIdentifier: your-guardrail-id
               guardrailVersion: "1"  # or "DRAFT"
               region: us-west-2
               policies:
                 backendAuth:
                   aws: {}
           response:
           - bedrockGuardrails:
               guardrailIdentifier: your-guardrail-id
               guardrailVersion: "1"
               region: us-west-2
               policies:
                 backendAuth:
                   aws: {}
   EOF
   ```

{{< callout type="info" >}}
The `aws: {}` configuration uses the default AWS credential chain (IAM role, environment variables, or instance profile). For authentication details, see the [AWS authentication documentation](https://docs.aws.amazon.com/sdk-for-go/api/aws/session/).
{{< /callout >}}

### Google Model Armor

Google Model Armor (formerly Vertex AI Safety) provides content safety filtering for Google Cloud customers. Configuration follows a similar pattern to other external moderation endpoints.

{{< callout type="info" >}}
For Google Model Armor configuration details, contact Solo.io support or consult the Google Cloud documentation for Vertex AI content safety features.
{{< /callout >}}

## Layer 3: Custom webhook integration

For advanced content safety requirements beyond regex and cloud provider services, you can integrate custom webhook servers. This allows you to use specialized ML models, proprietary detection logic, or integrate with existing security tools.

### Use cases for custom webhooks

- Named Entity Recognition (NER) for detecting person names, organizations, locations
- Industry-specific compliance rules (HIPAA, PCI-DSS, GDPR)
- Integration with existing DLP or security tools
- Custom ML models for domain-specific content detection
- Multi-step validation workflows
- Advanced contextual analysis

### Webhook configuration

Configure a prompt guard to call your webhook service:

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: content-safety-webhook
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
        - webhook:
            backendRef:
              kind: Service
              name: content-safety-webhook
              port: 8000
        response:
        - webhook:
            backendRef:
              kind: Service
              name: content-safety-webhook
              port: 8000
EOF
```

For a complete guide on implementing and deploying custom webhook servers, see the [Guardrail Webhook API documentation]({{< link-hextra path="/llm/guardrail-api/guardrail-guide/" >}}).

## Combining multiple layers

You can configure multiple prompt guards that run in sequence, creating defense-in-depth protection. Guards are evaluated in the order they appear in the configuration.

Example configuration that uses all three layers:

```yaml
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: content-safety-layered
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
        # Layer 1: Fast regex check for known patterns
        - regex:
            builtins:
            - Ssn
            - CreditCard
            - Email
            action: Reject
          response:
            message: "Request contains PII and cannot be processed"
        # Layer 2: OpenAI moderation for harmful content
        - openAIModeration:
            policies:
              auth:
                secretRef:
                  name: openai-secret
            model: omni-moderation-latest
          response:
            message: "Content blocked by moderation policy"
        # Layer 3: Custom webhook for domain-specific checks
        - webhook:
            backendRef:
              kind: Service
              name: content-safety-webhook
              port: 8000
        response:
        # Response guards run in same order
        - regex:
            builtins:
            - Ssn
            - CreditCard
            action: Mask
        - webhook:
            backendRef:
              kind: Service
              name: content-safety-webhook
              port: 8000
EOF
```

## What's next

- [Configure prompt guards]({{< link-hextra path="/llm/prompt-guards/" >}}) for step-by-step examples of regex-based guards
- [Guardrail Webhook API]({{< link-hextra path="/llm/guardrail-api/guardrail-guide/" >}}) for implementing custom content safety logic
- [Track costs]({{< link-hextra path="/llm/cost-tracking/" >}}) to monitor the impact of blocked requests on your budget
- [Set up observability]({{< link-hextra path="/llm/observability/" >}}) to track content safety metrics
