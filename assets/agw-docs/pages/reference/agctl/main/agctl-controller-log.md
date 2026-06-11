Get or set controller log levels

### Synopsis

Get or set log levels on the agentgateway controller.

With no flags, prints the current log level for each component.

When multiple controller pods are running, all are targeted and output
is prefixed per pod. All pods are attempted even if one fails.

```
agctl controller log [flags]
```

### Examples

```

agctl controller log                               # show current levels
agctl controller log --level debug                 # set all components to debug
agctl controller log --set reconciler=debug        # set a single component
agctl controller log --set reconciler=debug --set xds=info  # set multiple
```

### Options

```
  -p, --controller-admin-port int   Controller admin port (default 9095)
  -h, --help                        help for log
      --level string                Set log level for all components (error|warn|info|debug|trace)
  -n, --namespace string            Namespace where the controller is running (default "agentgateway-system")
      --set stringArray             Set a component log level: component=level (may be repeated)
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl controller](../agctl-controller/)	 - Inspect and manage the agentgateway controller

