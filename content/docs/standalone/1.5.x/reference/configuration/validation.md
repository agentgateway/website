---
title: Schema validation
weight: 1
description: Configure your IDE or editor to validate agentgateway YAML against the JSON schema.
---

Many integrated development environments (IDEs) and editors support schema validation for your standalone agentgateway configuration file.

## Default schema validation off `main`

The examples throughout the docs use the following schema that redirects to the agentgateway config on `main`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
```

## Version-specific schema validation

Replace `$VERSION` in the following schema with the version of agentgateway that you are using, such as `{{< reuse "agw-docs/versions/n-patch.md" >}}`.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/tags/$VERSION/schema/config.json
```

For example:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agentgateway/agentgateway/refs/tags/v0.12.0/schema/config.json
```
