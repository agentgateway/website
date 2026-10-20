#### CLI alternative {#cli}

With agentgateway and httpbin running, [install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}), then apply two resource documents instead of adding the gateway and route in the UI. The CLI creates the gateway before the route that references it.

```sh
cat <<'EOF' > httpbin-resources.yaml
kind: traffic.gateway
value:
  name: httpbin
  port: 3000
---
kind: traffic.route
value:
  name: httpbin
  gateways: httpbin
  backends:
  - host: 127.0.0.1:8000
EOF
agctl standalone apply -f httpbin-resources.yaml
agctl standalone get traffic.gateway httpbin
agctl standalone get traffic.route httpbin -o yaml
```

Continue with Step 3 to verify routing. When you finish the quickstart, remove the route before its gateway.

```sh
agctl standalone delete traffic.route httpbin
agctl standalone delete traffic.gateway httpbin
```
