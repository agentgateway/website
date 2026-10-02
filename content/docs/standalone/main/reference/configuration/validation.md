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

## What schema validation checks

Schema validation checks that your configuration uses fields and value types from the agentgateway configuration schema. Runtime reference checks happen when the configuration is converted and used.

For example, a route or MCP target backend host can reference a top-level backend by its bare name. If the backend is named `upstream`, `backend: upstream` resolves to the same local backend as `backend: /upstream`.

```yaml
backends:
- name: upstream
  host: example.com:80
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - backend: upstream
```

A reference that already includes a prefix, such as `namespace/upstream` or `/upstream`, keeps that prefix.
