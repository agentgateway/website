{{< conditional-text exclude-if="standalone" >}}The proxy uses DNS to resolve backend hostnames, such as the host of a static {{< reuse "agw-docs/snippets/backend.md" >}}, an LLM provider, or a Dynamic Forward Proxy destination. Kubernetes Services do not use DNS, because the proxy gets their endpoints from the control plane.{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}Agentgateway uses DNS to resolve backend hostnames, such as `host` backends, LLM providers, and dynamic backends.{{< /conditional-text >}} Each resolved address stays in a cache until the time to live (TTL) of the DNS record expires, but for at least 5 seconds. If the addresses behind a hostname change before the advertised TTL expires, requests go to old addresses until the next lookup. To refresh addresses sooner, set a maximum TTL with `config.dns.maxTtl`.

{{< conditional-text exclude-if="standalone" >}}
`config.dns.maxTtl` has no dedicated field. Set it in the `rawConfig` section of an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

1. Check whether the Gateway already references an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

   ```sh
   kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o jsonpath='{.spec.infrastructure.parametersRef}'
   ```

   If the command returns a reference, do not create a new resource, because the patch in step 3 replaces the reference. Instead, add `config.dns.maxTtl` to the `rawConfig` section of the referenced resource, and continue with step 4. If the command returns no output, continue with step 2.

2. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that caps the DNS cache time at 30 seconds. The Gateway's `rawConfig` replaces the entire `rawConfig` of the GatewayClass. The two are not merged.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: dns-max-ttl
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     rawConfig:
       config:
         dns:
           maxTtl: 30s
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `spec.rawConfig.config.dns.maxTtl` | The maximum time to keep a resolved address in the cache, regardless of the record's TTL. Use a duration with a unit, such as `30s` or `1m`. Set `0s` to turn off the cache, so that the proxy resolves the hostname each time that it needs an address. A value lower than 5 seconds also overrides the 5-second minimum. By default, the record's TTL applies. |

3. Reference the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource from the Gateway.

   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge \
     -p '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"dns-max-ttl"}}}}'
   ```

4. Wait for the new proxy pods. A `rawConfig` change restarts the proxy.

   ```sh
   kubectl rollout status deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

5. Verify the setting in the proxy configuration.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 & PF_PID=$!
   sleep 2
   curl -s localhost:15000/config_dump | jq '.config.dns.maxTtl'
   kill $PF_PID
   ```

   Example output:

   ```console
   "30s"
   ```

6. Optional: Remove the reference from the Gateway, and delete the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The proxy restarts with the default DNS cache time. If you added the setting to an existing resource in step 1, remove the setting from that resource instead.

   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type json \
     -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]'
   kubectl delete {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} dns-max-ttl -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
The following example caps the DNS cache time at 30 seconds.

```yaml
config:
  dns:
    maxTtl: 30s
```

| Setting | Description |
| -- | -- |
| `config.dns.maxTtl` | The maximum time to keep a resolved address in the cache, regardless of the record's TTL. Use a duration with a unit, such as `30s` or `1m`. Set `0s` to turn off the cache, so that agentgateway resolves the hostname each time that it needs an address. A value lower than 5 seconds also overrides the 5-second minimum. By default, the record's TTL applies. |

`config.dns` is a static setting, so restart agentgateway after you change it. To verify the setting, check the agentgateway configuration dump.

```sh
curl -s localhost:15000/config_dump | jq '.config.dns.maxTtl'
```

Example output:

```console
"30s"
```
{{< /conditional-text >}}
