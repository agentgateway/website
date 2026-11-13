Inspect and manage the agentgateway proxy

### Synopsis

Inspect and manage the agentgateway proxy admin API.

### Options

```
  -h, --help   help for proxy
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl](../agctl/)	 - agctl controls and inspects Agentgateway resources
{{% conditional-text include-if="kubernetes" %}}* [agctl proxy config](../agctl-proxy-config/)	 - Retrieve agentgateway configuration for a resource
{{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}* [agctl proxy log](../agctl-proxy-log/)	 - Get or set proxy log levels
{{% /conditional-text %}}* [agctl proxy profile](../agctl-proxy-profile/)	 - Collect Agentgateway proxy pprof profiles
* [agctl proxy trace](../agctl-proxy-trace/)	 - Trace requests handled by an agentgateway pod or local instance.

