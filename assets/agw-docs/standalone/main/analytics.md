## Query analytics with agctl {#cli}

Use `agctl standalone analytics` to query the same request-log database as the dashboard. [Install and connect agctl]({{< link-hextra path="/documentation/operations/config-resources/#connect" >}}) before running these commands. The database must contain LLM requests; a configured model with no traffic has no analytics to report.

1. Summarize the past 24 hours. The default table reports requests, errors, tokens, realized cost, average time to first token (TTFT), generation tokens per second, and the cache-read share of input tokens.

   ```sh
   agctl standalone analytics
   ```

2. Group the results by provider and requested model. Use `168h` for seven days; `--since` accepts durations such as `30m` and `24h`, not day suffixes.

   ```sh
   agctl standalone analytics --by provider,model --since 168h
   ```

3. Inspect user or group spending. These groupings use the stored attributes, including the gateway's standard identity mappings.

   ```sh
   agctl standalone analytics --by agentgateway.user --since 24h
   agctl standalone analytics --by agentgateway.group --since 24h
   ```

4. Break the results into hourly buckets and filter to a provider.

   ```sh
   agctl standalone analytics --by model --provider openai --since 6h --interval 1h
   ```

5. Export the summary as JSON for further processing.

   ```sh
   agctl standalone analytics --by provider,model --since 24h -o json > analytics.json
   ```

Use `--by response-model` to group by the upstream response model, or `--by model,ttft` for TTFT histogram buckets per requested model. A custom attribute is also a valid grouping, such as `--by team`, when you [store that attribute in database logs]({{< link-hextra path="/documentation/observability/access-logs/database/#add-custom-fields-to-database-logs" >}}).

Analytics describes recorded traffic, not budget enforcement or a provider invoice. Filtered-out requests do not contribute, and unpriced requests contribute no cost. Use [`agctl standalone budgets`]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/#step-6-check-budget-usage" >}}) for per-key budget counters. For all filters and formats, see the [`analytics` reference]({{< link-hextra path="/reference/agctl/agctl-standalone-analytics/" >}}).
