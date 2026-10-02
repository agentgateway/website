Collect a CPU pprof profile

```
agctl proxy profile cpu [resource] [flags]
```

### Examples

```
  agctl proxy profile cpu gateway/my-gateway --seconds 30 -o ./profile.pb.gz
  agctl proxy profile cpu --local -p 15000
```

### Options

```
  -h, --help          help for cpu
      --seconds int   CPU profile duration in seconds (default 30)
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
      --local               Profile a local agentgateway instance on localhost
  -n, --namespace string    Namespace to use when resolving resources
  -o, --output string       Output profile path
  -p, --port int            Agentgateway proxy admin port (default 15000)
```

### SEE ALSO

* [agctl proxy profile](../agctl-proxy-profile/)	 - Collect Agentgateway proxy pprof profiles

