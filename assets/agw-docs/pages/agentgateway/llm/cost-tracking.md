Track and monitor LLM costs per request using token usage metrics.

## About

Cost tracking (also known as spend monitoring or usage tracking) helps you monitor and control expenses from LLM API calls. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} automatically tracks token consumption for every request and response, allowing you to calculate costs based on your provider's pricing model.

Token metrics are exposed through Prometheus metrics and OpenTelemetry traces. You can use these metrics to:
- Calculate costs per request, per user, or per model
- Set up budget alerts and spending limits
- Analyze usage patterns to optimize costs
- Generate cost reports for chargeback or showback

This guide shows you how to access token usage data and calculate costs from that data.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Set up observability

To set up advanced observability with Grafana, Prometheus, and OpenTelemetry for cost dashboards and alerts, see the [OTel stack guide]({{< link-hextra path="/observability/otel-stack/" >}}).

## View token usage metrics

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} exposes the `agentgateway_gen_ai_client_token_usage` Prometheus metric that tracks input and output tokens for each request.

1. Port-forward the agentgateway proxy on port 15020.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15020
   ```

2. Open the {{< reuse "agw-docs/snippets/agentgateway.md" >}} [metrics endpoint](http://localhost:15020/metrics).

3. Look for the `agentgateway_gen_ai_client_token_usage` metric. This histogram includes labels that identify each request:
   - `gen_ai_token_type`: Whether the metric measures `input` or `output` tokens
   - `gen_ai_operation_name`: The operation type, such as `chat` or `completion`
   - `gen_ai_system`: The LLM provider, such as `openai` or `anthropic`
   - `gen_ai_request_model`: The model used for the request
   - `gen_ai_response_model`: The model that responded (may differ from requested model)

   Example metric output:
   ```
   agentgateway_gen_ai_client_token_usage_bucket{gen_ai_operation_name="chat",gen_ai_request_model="gpt-4",gen_ai_response_model="gpt-4-0613",gen_ai_system="openai",gen_ai_token_type="input",le="100"} 5
   agentgateway_gen_ai_client_token_usage_sum{gen_ai_operation_name="chat",gen_ai_request_model="gpt-4",gen_ai_response_model="gpt-4-0613",gen_ai_system="openai",gen_ai_token_type="input"} 342
   agentgateway_gen_ai_client_token_usage_count{gen_ai_operation_name="chat",gen_ai_request_model="gpt-4",gen_ai_response_model="gpt-4-0613",gen_ai_system="openai",gen_ai_token_type="input"} 5
   ```

   The `_sum` suffix shows total tokens consumed, and `_count` shows the number of requests.

For more information about the token usage metric, see the [Semantic conventions for generative AI metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/) in the OpenTelemetry documentation.

## Calculate costs from token metrics

To calculate costs, multiply token counts by your provider's pricing. Most LLM providers charge separately for input tokens and output tokens.

### Common pricing models

Check your LLM provider's pricing page for current rates. Most providers charge separately for input tokens and output tokens, with prices varying by model and usage. Refer to the LLM provider docs.

- [OpenAI pricing](https://openai.com/api/pricing/)
- [Anthropic pricing](https://claude.com/pricing)
- [Google AI pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
- [Azure OpenAI pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)

### Cost calculation formula

Use this formula to calculate the cost per request:

```
cost = (input_tokens / 1,000,000 × input_price) + (output_tokens / 1,000,000 × output_price)
```

Example calculation for a GPT-4 request with 500 input tokens and 1,000 output tokens:
```
cost = (500 / 1,000,000 × $30.00) + (1,000 / 1,000,000 × $60.00)
     = $0.015 + $0.060
     = $0.075
```

### Query costs with PromQL

If you have Prometheus set up, you can query aggregate costs using PromQL. This example calculates total cost for GPT-4 requests over the last hour:

```promql
# Total input cost for GPT-4 (assuming $30 per 1M input tokens)
(sum(rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_request_model="gpt-4",gen_ai_token_type="input"}[1h])) / 1000000) * 30

# Total output cost for GPT-4 (assuming $60 per 1M output tokens)
(sum(rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_request_model="gpt-4",gen_ai_token_type="output"}[1h])) / 1000000) * 60

# Combined total cost per hour
((sum(rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_request_model="gpt-4",gen_ai_token_type="input"}[1h])) / 1000000) * 30) + ((sum(rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_request_model="gpt-4",gen_ai_token_type="output"}[1h])) / 1000000) * 60)
```

## Track costs per user

To track costs per user, combine token metrics with user identification from API keys or JWT claims.

1. Set up API key authentication to identify users. See the [API key management guide]({{< link-hextra path="/llm/api-keys/" >}}) for details.

2. Query metrics filtered by user ID. The `X-User-ID` header value is available in Prometheus labels when you configure rate limiting with user identification.

   Example PromQL query for per-user costs:
   ```promql
   # Cost per user over the last 24 hours
   sum by (user_id) (
     ((rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) / 1000000) * 30) +
     ((rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]) / 1000000) * 60)
   )
   ```

## Set up cost alerts

Use Prometheus AlertManager to trigger alerts when costs exceed thresholds.

Example alert rule for daily spending over $100:

```yaml
groups:
- name: llm_cost_alerts
  rules:
  - alert: HighDailyCost
    expr: |
      (
        (sum(rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[24h]) * 86400) / 1000000 * 30) +
        (sum(rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="output"}[24h]) * 86400) / 1000000 * 60)
      ) > 100
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Daily LLM costs exceed $100"
      description: "Estimated daily cost is {{ $value | humanize }}. Review usage patterns."
```

## View costs in OpenTelemetry traces

OpenTelemetry traces include token usage as span attributes. You can view per-request token counts in your tracing backend (such as Grafana Tempo, Jaeger, or Langfuse).

1. Set up OpenTelemetry tracing. See the [tracing guide]({{< link-hextra path="/llm/tracing/" >}}) for setup instructions.

2. Search for traces with LLM requests. Each trace includes these attributes:
   - `gen_ai.usage.input_tokens`: Number of input tokens
   - `gen_ai.usage.output_tokens`: Number of output tokens
   - `gen_ai.request.model`: Model used
   - `gen_ai.response.model`: Model that responded

3. Calculate costs using the same formula as above, using the token counts from trace attributes.

## Enforce spending limits

To enforce per-user spending limits, combine cost tracking with rate limiting:

1. Set up token-based rate limiting with `type: TOKEN` keyed by `X-User-ID`. See the [budget and spend limits guide]({{< link-hextra path="/llm/budget-limits/" >}}).

2. Configure the daily token limit based on your budget. For example, a $10 daily budget for GPT-4 allows approximately 166,000 input tokens or 166,000 output tokens (assuming mixed usage).

3. Monitor actual spending with the metrics queries shown above to ensure rate limits align with budget goals.

For more information, see the [budget and spend limits guide]({{< link-hextra path="/llm/budget-limits/" >}}).

## What's next

- [Set up budget and spend limits]({{< link-hextra path="/llm/budget-limits/" >}}) to enforce per-user token budgets
- [Set up API key authentication]({{< link-hextra path="/llm/api-keys/" >}}) to track costs per user
- [View metrics and logs]({{< link-hextra path="/llm/observability/" >}}) for general observability
- [Set up tracing]({{< link-hextra path="/llm/tracing/" >}}) for detailed request analysis
