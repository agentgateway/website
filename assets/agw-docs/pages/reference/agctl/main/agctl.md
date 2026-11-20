agctl controls and inspects Agentgateway resources

### Options

```
  -h, --help                help for agctl
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

{{% conditional-text include-if="kubernetes" %}}* [agctl bug-report](../agctl-bug-report/)	 - Collect agentgateway resources, logs, and metrics into an archive
{{% /conditional-text %}}* [agctl catalog](../agctl-catalog/)	 - Manage model catalogs
{{% conditional-text include-if="kubernetes" %}}* [agctl controller](../agctl-controller/)	 - Inspect and manage the agentgateway controller
{{% /conditional-text %}}{{% conditional-text include-if="kubernetes" %}}* [agctl migrate](../agctl-migrate/)	 - Migrate agentgateway resources to newer configurations
{{% /conditional-text %}}* [agctl proxy](../agctl-proxy/)	 - Inspect and manage the agentgateway proxy
{{% conditional-text include-if="standalone" %}}* [agctl standalone](../agctl-standalone/)	 - Manage a standalone agentgateway
{{% /conditional-text %}}* [agctl version](../agctl-version/)	 - Print agctl version information

