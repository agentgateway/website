Create an API key and print it

### Synopsis

Create an API key and print it. The key is stored as a SHA-256 hash and
cannot be retrieved again.

Budgets are written as AMOUNT[/WINDOW], where AMOUNT is in USD (10usd or $10)
or tokens (1000000tokens), and WINDOW defaults to 30d.

```
agctl standalone keys create NAME [flags]
```

### Examples

```
  agctl standalone keys create alice
  agctl standalone keys create ci --model 'openai/*' --budget 5usd/24h --budget-action block
```

### Options

```
      --budget stringArray     Budget as AMOUNT[/WINDOW], for example 10usd/30d or 1000000tokens/24h (repeatable)
      --budget-action string   Action when a budget is exceeded: audit or block (default "audit")
  -h, --help                   help for create
      --model strings          Model pattern the key may use (repeatable; default all)
```

### Options inherited from parent commands

```
      --address string      Standalone agentgateway admin address
      --gateway string      Gateway name from the config file
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl standalone keys](../agctl-standalone-keys/)	 - List and create LLM API keys

