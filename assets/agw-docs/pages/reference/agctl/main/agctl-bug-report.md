Collect agentgateway resources, logs, and metrics into an archive

### Synopsis

Collect agentgateway resources, logs, and metrics into an archive for bug reports.

Captured resources are all Gateway API resources, and all resources with a category containing
"agentgateway". Services, ConfigMaps, Secrets, and Events are captured from every namespace holding one of
those resources, or the controller. Secret values are redacted.

Logs and metrics are captured from agentgateway proxy pods and all pods in the controller namespace.

```
agctl bug-report [flags]
```

### Examples

```
agctl bug-report
agctl bug-report -n team-a -n team-b --since 1h
agctl bug-report --config-dump -o /tmp/report.tar.gz
```

### Options

```
      --config-dump         Capture /config_dump from each proxy
  -h, --help                help for bug-report
  -n, --namespace strings   Only capture namespaced resources and proxies in these namespaces. The controller namespace is always captured.
  -o, --output string       Output archive (default "bug-report.tar.gz")
      --since duration      Only capture logs newer than this duration (default 24h0m0s)
      --tail int            Maximum log lines per container; 0 for no limit (default 5000)
      --timeout duration    Deadline for the whole collection; anything collected before it is still written (default 5m0s)
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl](../agctl/)	 - agctl controls and inspects Agentgateway resources

