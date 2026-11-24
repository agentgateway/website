Display one or more resources

```
agctl standalone get KIND [NAME] [flags]
```

### Options

```
  -h, --help            help for get
  -n, --no-metadata     Omit server-managed fields for use with apply. In hybrid mode, also use --source database when exporting for apply.
  -o, --output string   Output format: table, yaml, or json (default "table")
      --source string   Filter by resource source: file or database (default: all)
```

### Options inherited from parent commands

```
      --address string      Standalone agentgateway admin address
      --gateway string      Gateway name from the config file
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl standalone](../agctl-standalone/)	 - Manage a standalone agentgateway

