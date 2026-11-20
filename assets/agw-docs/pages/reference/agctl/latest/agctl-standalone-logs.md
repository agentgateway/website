Display request logs

### Synopsis

Display request logs from the standalone agentgateway request log database.

With no ID, prints the most recent requests, oldest first. With an ID, prints
that request including its stored prompt and completion.

```
agctl standalone logs [ID] [flags]
```

### Examples

```
  agctl standalone logs
  agctl standalone logs -f --model gpt-4o
  agctl standalone logs --since 1h --status 429 --status 500
  agctl standalone logs 0198f5c2-...
```

### Options

```
      --attributes               Include all logged attributes
  -f, --follow                   Stream new requests as they complete
  -h, --help                     help for logs
      --limit int                Number of recent requests to show (max 500) (default 20)
      --model strings            Filter by requested model (repeatable)
  -o, --output string            Output format: table, yaml, or json (default "table")
      --provider strings         Filter by LLM provider (repeatable)
      --response-model strings   Filter by response model (repeatable)
      --since duration           Only show requests newer than a relative duration, like 5m or 1h
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

