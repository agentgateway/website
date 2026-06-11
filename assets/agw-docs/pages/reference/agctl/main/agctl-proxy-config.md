Retrieve agentgateway configuration for a resource

### Synopsis

Retrieve agentgateway configuration for a resource, such as the agentgateway controller or proxy.

### Options

```
  -f, --file string            Agentgateway config dump JSON file
  -h, --help                   help for config
  -n, --namespace string       Namespace to use when resolving resources
  -o, --output string          Output format: one of short|json|yaml (default "short")
      --proxy-admin-port int   Agentgateway admin port (default 15000)
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl proxy](../agctl-proxy/)	 - Inspect and manage the agentgateway proxy
* [agctl proxy config all](../agctl-proxy-config-all/)	 - Retrieve all Agentgateway configuration
* [agctl proxy config backends](../agctl-proxy-config-backends/)	 - Retrieve Agentgateway backend endpoint status

