---
title: Configuration reference
weight: 11
description: 
---

The agentgateway schema is available as a [JSON schema](https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.json). Review this page for more information about the schema and how to use it.

## Config file validation

Many integrated development environments (IDEs) and editors support schema validation for your standalone agentgateway configuration file. 


**Default schema validation off `main`**
The examples throughout the docs use the following schema that redirects to the agentgateway config on `main`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
```

**Version-specific schema validation**

Replace `$VERSION` in the following schema with the version of agentgateway that you are using, such as `{{< reuse "agw-docs/versions/n-patch.md" >}}`.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/tags/$VERSION/schema/config.json
```

For example:
```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/tags/v0.12.0/schema/config.json
```

## Schema

The following table shows the complete agentgateway configuration file schema, with columns for the field and description.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.md"
    section="Configuration File Schema"
%}}
