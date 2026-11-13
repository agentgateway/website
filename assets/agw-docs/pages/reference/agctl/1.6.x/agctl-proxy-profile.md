Collect Agentgateway proxy pprof profiles

### Synopsis

Collect CPU or heap pprof profiles from an Agentgateway proxy admin endpoint.

### Options

```
  -h, --help               help for profile
      --local              Profile a local agentgateway instance on localhost
  -n, --namespace string   Namespace to use when resolving resources
  -o, --output string      Output profile path
  -p, --port int           Agentgateway proxy admin port (default 15000)
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl proxy](../agctl-proxy/)	 - Inspect and manage the agentgateway proxy
* [agctl proxy profile cpu](../agctl-proxy-profile-cpu/)	 - Collect a CPU pprof profile
* [agctl proxy profile heap](../agctl-proxy-profile-heap/)	 - Collect a heap pprof profile

