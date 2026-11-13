Collect a heap pprof profile

```
agctl proxy profile heap [resource] [flags]
```

### Examples

```
  agctl proxy profile heap gateway/my-gateway -o ./heap.pb.gz
  agctl proxy profile heap --local -p 15000
```

### Options

```
  -h, --help   help for heap
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

