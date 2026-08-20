> [!TIP]
> For possible agentgateway settings, check out the schema and interactive explorer tool in the [Configuration reference docs]({{< link-hextra path="/reference/configuration/" >}}).

1. Create a Helm values configuration file, such as `values.yaml`. Note that the value nests: the outer `config` is the Helm value, and the inner `config` is agentgateway's own `config` section.

   ```yaml
   cat <<'EOF' > values.yaml
   config:                    # Helm value: the whole configuration file
     binds:                   # agentgateway top-level field
     - port: 4000
       listeners:
       - routes:
         - backends:
           - host: httpbin.httpbin.svc.cluster.local:8000
     config:                  # agentgateway's own config section
       logging:
         level: info
   EOF
   ```

2. Pass the file to Helm during the upgrade.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}