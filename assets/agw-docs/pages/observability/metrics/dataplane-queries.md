## Example PromQL queries

Use these queries in Prometheus or as the basis for Grafana panels and alerts. To enter a raw PromQL query in Grafana, switch the query editor from **Builder** to **Code** mode.

| Use case | PromQL query |
| --- | --- |
| Request rate | `rate(agentgateway_requests_total[5m])` |
| Error rate | `rate(agentgateway_requests_total{status=~"5.."}[5m]) / rate(agentgateway_requests_total[5m])` |
| LLM token usage (input) | `sum by (gen_ai_system, gen_ai_request_model) (rate(agentgateway_gen_ai_client_token_usage_sum{gen_ai_token_type="input"}[5m]))` |
| Time to first token (p95) | `histogram_quantile(0.95, rate(agentgateway_gen_ai_server_time_to_first_token_bucket[5m]))` |
| MCP tool call rate by tool | `sum by (server, resource) (rate(agentgateway_mcp_requests_total{method="tools/call"}[5m]))` |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" >}}
| MCP tool call outcomes by tool | `sum by (server, resource, outcome) (rate(agentgateway_mcp_requests_total{method="tools/call"}[5m]))` |
| Active HTTP requests by backend | `sum by (backend) (agentgateway_requests_active)` |
| Open upstream connections by backend | `sum by (backend) (agentgateway_upstream_connections_active)` |{{< /version >}}
