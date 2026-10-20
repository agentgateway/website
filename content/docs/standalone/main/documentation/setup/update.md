---
title: Update your configuration
weight: 40
description: Change the agentgateway configuration of a running instance, for each installation method.
test: skip
---

{{< reuse "agw-docs/standalone/setup/update.md" >}}

## Update resources with agctl {#agctl}

Use `agctl standalone apply` to update individual resources through the running gateway's API. The CLI writes to your configuration file in file mode, or to the database overlay in hybrid mode.

1. [Install and connect agctl]({{< link-hextra path="/documentation/operations/config-resources/#connect" >}}).
2. Export the resource that you want to change. Replace `example-model` with a model from `agctl standalone get llm.model`.

   ```sh
   agctl standalone get llm.model example-model -o yaml --no-metadata > model.yaml
   ```

3. Edit the resource's `value` fields, then apply it.

   ```sh
   agctl standalone apply -f model.yaml
   agctl standalone get llm.model example-model -o yaml
   ```

Use resource documents with `kind` and `value`, as shown in [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/#apply" >}}). A complete `config.yaml` is not valid input to `agctl standalone apply`. Startup settings, such as `config.database` or `config.adminAddr`, still require the file-edit and restart workflow above. In hybrid mode, edit file-owned resources in the baseline file.
