> [!TIP]
> Before you apply the rules, check that your IdP adds the `groups` claim to your ID token. If the claim is missing, the `agentgateway-admins` rule does not match your requests, and then saves from the UI on the gateway return a `403` response. To fix the rule, update your configuration file and apply the change again.

1. Add the rules to the `ui.policies` section that has your authentication policy. In a Helm installation, the section is `config.ui.policies` in your values file.

   ```yaml
   ui:
     policies:
       authorization:
         rules:
         - allow: '"agentgateway-admins" in jwt.groups'
         - allow: 'request.method == "GET"'
         - allow: 'request.path.startsWith("/api/logs/") || request.path == "/api/cel"'
   ```

2. Apply the change. Agentgateway reloads the `ui` section of your configuration file without a restart. In a Helm installation, upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}
