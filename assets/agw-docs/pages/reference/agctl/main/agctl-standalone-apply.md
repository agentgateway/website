Apply resources from YAML or JSON

### Synopsis

Apply resources from YAML or JSON.

Each resource has a kind and value, for example:

  kind: llm.model
  value:
    name: llama
    provider: ollama
    params:
      model: llama3

```
agctl standalone apply -f FILENAME [flags]
```

### Options

```
  -f, --filename string   YAML or JSON file (use - for stdin)
  -h, --help              help for apply
```

### Options inherited from parent commands

```
      --address string      Standalone agentgateway admin address
      --gateway string      Gateway name from the config file
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl standalone](../agctl-standalone/)	 - Manage a standalone agentgateway

