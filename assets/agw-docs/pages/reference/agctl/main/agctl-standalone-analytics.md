Summarize request counts, tokens, cost, and latency

### Synopsis

Summarize request counts, tokens, cost, and latency from the request log database.

--by groups results by provider, model, response-model, status, ttft,
tokens-per-second, or any logged attribute such as agentgateway.user.
ttft and tokens-per-second group into histogram buckets labelled by their lower bound.
--interval breaks results down over time.

```
agctl standalone analytics [flags]
```

### Examples

```
  agctl standalone analytics
  agctl standalone analytics --by provider,model --since 168h
  agctl standalone analytics --by agentgateway.user --provider openai
  agctl standalone analytics --by model --since 6h --interval 1h
  agctl standalone analytics --by model,ttft
```

### Options

```
      --by strings               Group by provider, model, response-model, status, ttft, tokens-per-second, or a log attribute (repeatable)
  -h, --help                     help for analytics
      --interval duration        Break results down into buckets of this duration
      --model strings            Filter by requested model (repeatable)
  -o, --output string            Output format: table, yaml, or json (default "table")
      --provider strings         Filter by LLM provider (repeatable)
      --response-model strings   Filter by response model (repeatable)
      --since duration           Summarize requests newer than a relative duration (default 24h0m0s)
      --status int64Slice        Filter by HTTP status (repeatable)
      --trace-id string          Filter by trace ID
```

### Options inherited from parent commands

```
      --address string      Standalone agentgateway admin address
      --gateway string      Gateway name from the config file
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl standalone](../agctl-standalone/)	 - Manage a standalone agentgateway

