Manage a standalone agentgateway

### Synopsis

Manage configuration resources through a standalone agentgateway admin API.

The gateway address is taken from --gateway, --address, $AGCTL_STANDALONE_ADDRESS,
the current gateway in the config file, or http://localhost:15000, in that order.

The config file is read from $AGCTL_CONFIG, or agctl/config.yaml in
the user config directory (typically ~/.config/agctl/config.yaml). Gateways may
authenticate with a kubectl credential plugin, using the kubeconfig exec schema:

  current: prod
  gateways:
    local:
      url: http://localhost:15000
    prod:
      url: https://agw.example.com
      exec:
        command: kubectl
        args: [oidc-login, get-token, --oidc-issuer-url=https://issuer.example.com, --oidc-client-id=agctl]

### Examples

```
  agctl standalone get llm.models
  agctl standalone get all -o yaml
  agctl standalone apply -f resources.yaml
  agctl standalone delete llm.models my-model
  agctl standalone --gateway prod get all
```

### Options

```
      --address string   Standalone agentgateway admin address
      --gateway string   Gateway name from the config file
  -h, --help             help for standalone
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl](../agctl/)	 - agctl controls and inspects Agentgateway resources
* [agctl standalone analytics](../agctl-standalone-analytics/)	 - Summarize request counts, tokens, cost, and latency
* [agctl standalone apply](../agctl-standalone-apply/)	 - Apply resources from YAML or JSON
* [agctl standalone budgets](../agctl-standalone-budgets/)	 - Show API key budget usage
* [agctl standalone delete](../agctl-standalone-delete/)	 - Delete a resource
* [agctl standalone get](../agctl-standalone-get/)	 - Display one or more resources
* [agctl standalone keys](../agctl-standalone-keys/)	 - List and create LLM API keys
* [agctl standalone logs](../agctl-standalone-logs/)	 - Display request logs

