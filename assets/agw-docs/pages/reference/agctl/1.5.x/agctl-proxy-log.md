Get or set proxy log levels

### Synopsis

Get or set log levels on the agentgateway proxy.

With no flags, prints the current active log filter directive.

The proxy uses Rust tracing-subscriber filter directives. Module names are
Rust crate paths, such as 'agentgateway::proxy'. See the agentgateway docs for
the full list of valid module paths. Level changes via '--set' are additive:
they append to the current directive rather than replacing it. Use '--level'
to reset to a clean global level.

When multiple pods back a resource, all are targeted and output is
prefixed per pod. All pods are attempted even if one fails.

```
agctl proxy log [resource] [flags]
```

### Examples

```
agctl proxy log                                      # show current directive
agctl proxy log --level debug                        # set global level
agctl proxy log --set agentgateway::proxy=debug      # set a single module
agctl proxy log --set agentgateway::proxy=debug,agentgateway::http=info
```

### Options

```
  -h, --help                   help for log
      --level string           Set global log level (error|warn|info|debug|trace|off)
  -n, --namespace string       Namespace for proxy pod resolution
  -p, --proxy-admin-port int   Proxy admin port (default 15000)
      --set stringArray        Set module log level: module=level (may be repeated or comma-separated)
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl proxy](../agctl-proxy/)	 - Inspect and manage the agentgateway proxy

