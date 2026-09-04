> [!TIP]
> For possible agentgateway settings, check out the schema and interactive explorer tool in the [Configuration reference docs]({{< link-hextra path="/reference/configuration/" >}}).

1. Create a Helm values configuration file, such as `values.yaml`. The `config` Helm value holds your entire agentgateway configuration file. Note that agentgateway's own top-level fields include a section that is also named `config`, so that section ends up nested inside the `config` Helm value.

   ```yaml
   cat <<'EOF' > values.yaml
   config:                    # Helm value: the whole agentgateway configuration file
     binds:                   # agentgateway field
     - port: 4000
       listeners:
       - routes:
         - backends:
           - host: httpbin.httpbin.svc.cluster.local:8000
     config:                  # agentgateway field: agentgateway's own 'config' section
       logging:
         level: info
   EOF
   ```

2. Pass the file to Helm during the upgrade.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}