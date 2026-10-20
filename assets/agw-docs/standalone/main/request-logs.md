## View LLM request logs with agctl {#cli}

Use `agctl standalone logs` to inspect recorded LLM requests without opening the UI or connecting a database client. [Install and connect agctl]({{< link-hextra path="/documentation/operations/config-resources/#connect" >}}), and [configure a request-log database]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}) before you begin.

The command reads database records, not stdout. Currently, database request logging captures LLM traffic. Use the gateway process or container logs for startup errors, configuration reloads, and ordinary HTTP or MCP access logs. Use `agctl proxy log` to change process log levels.

1. List recent requests. By default, the command shows the most recent 20 records, oldest first, with status, duration, provider, model, tokens, cost, and request ID.

   ```sh
   agctl standalone logs --limit 10
   ```

2. Filter by time, HTTP status, provider, or requested model. The status example includes either `429` or `500` responses that were stored in the database.

   ```sh
   agctl standalone logs --since 1h --status 429 --status 500
   agctl standalone logs --provider openai --model gpt-5
   ```

   Use `--response-model` to filter by the upstream response model, or `--trace-id` to locate requests associated with a recorded trace ID. `--since` accepts durations such as `5m` and `24h`.

3. Follow new requests as they complete. Stop following with `Ctrl+C`.

   ```sh
   agctl standalone logs -f --model gpt-5
   ```

4. Inspect one request with an ID from the listing. The default detail output is YAML; add `-o json` for JSON.

   ```sh
   agctl standalone logs <request-id>
   ```

   The result includes stored prompts and completions only if payload capture was enabled for that request. Set `frontendPolicies.accessLog.database.llm: full` to capture payloads for subsequent requests, as described in [Access log data storage]({{< link-hextra path="/documentation/observability/access-logs/database/#access-log-data-storage" >}}). Payload capture does not recover content from older records.

5. Include custom database attributes in structured output.

   ```sh
   agctl standalone logs --since 1h --attributes -o json
   ```

   Custom attributes must be configured under `frontendPolicies.accessLog.database.add`. Fields added only to stdout with `accessLog.add` do not appear in these records.

The `--limit` flag accepts up to 500 recent records. JSON list output contains a `logs` array; `logs -f -o json` streams one JSON record per line. For aggregate counts, token usage, and cost, use [CLI analytics]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}). For every flag, see the [`logs` reference]({{< link-hextra path="/reference/agctl/agctl-standalone-logs/" >}}).
