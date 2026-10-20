---
title: Configuration storage
weight: 30
description: Choose whether agentgateway stores UI-managed configuration in your config file, in a database, or not at all.
test: skip
aliases:
  - ../../deployment/helm/storage/
---

{{< reuse "agw-docs/standalone/setup/storage.md" >}}

## Manage stored resources with agctl {#agctl}

Use `agctl standalone` for the same resource operations shown in the API tabs above. [Install agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) and connect to the API address for your installation. For Helm, keep the admin port-forward running.

1. Create an MCP target resource. Replace the example host with your MCP server's URL.

   ```sh
   cat <<'EOF' > target.yaml
   kind: mcp.target
   value:
     name: cli-target
     mcp:
       host: http://example.com/mcp
   EOF
   agctl standalone apply -f target.yaml
   ```

2. Verify the stored resource. In file mode, the target is in your configuration file. In hybrid mode, it is in the database overlay and the baseline file is unchanged.

   ```sh
   agctl standalone get mcp.target cli-target -o yaml
   ```

3. Remove the target when you finish testing.

   ```sh
   agctl standalone delete mcp.target cli-target
   ```

The CLI requires a writable file in file mode, and writes are rejected in `readOnly` mode. The standalone Helm chart needs database mode for writes to succeed. For details about which resources are listed, see [CLI storage behavior]({{< link-hextra path="/documentation/operations/config-resources/#storage-behavior" >}}).
