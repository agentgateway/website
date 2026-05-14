Trace the next request handled by an Agentgateway pod or local instance

### Synopsis

Start an Agentgateway debug trace, render it in a TUI or JSONL, and optionally trigger the traced request against a pod or a local instance.

```
agctl trace [resource] [-- <curl args...>] [flags]
```

### Examples

```
  agctl trace
  # Watch for the next request on a pod and trace it, displaying the result in a TUI
  agctl trace gateway/my-gateway
  # Watch for the next request on a pod and trace it, displaying the result in a JSONL format
  agctl trace --raw
	# Enable tracing and send a request to the gateway. The <host> part of the request is only used for setting the Hostname of the request,
  # and is not used for DNS resolution.
  agctl trace --port 80 -- http://host/some/path
  # Enable tracing and send a request to the gateway running locally.
  agctl trace --local --port 8080 -- http://host/some/path
  # Enable tracing and send a request to the gateway, with some curl arguments.
  agctl trace gateway/my-gateway --raw --port 80 -- http://host/some/path -H "Authorization: Bearer sk-123"
```

### Options

```
  -h, --help                   help for trace
      --local                  Trace against a local agentgateway instance on 127.0.0.1
  -n, --namespace string       Namespace to use when resolving resources
      --port int               Gateway listener port to use when triggering a request
      --proxy-admin-port int   Agentgateway admin port (default 15000)
      --raw                    Print trace events as JSONL instead of opening the TUI
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl](../agctl/)	 - agctl controls and inspects Agentgateway resources

