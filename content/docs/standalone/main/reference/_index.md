---
title: Reference
weight: 110
description: Configuration and CEL expression reference for agentgateway.
test: skip
---

Reference documentation for the agentgateway standalone binary. Configuration and CEL context pages are auto-generated from the agentgateway JSON schemas.

{{< cards >}}
  {{< card link="full-schema" title="Full Schema" subtitle="All types on a single page for quick searching" >}}
  {{< card link="by-section" title="By Section" subtitle="Navigable per-section breakdown" >}}
  {{< card link="cel" title="CEL expressions" >}}
  {{< card link="observability" title="Observability" >}}
  {{< card link="release-notes" title="Release notes" >}}
{{< /cards >}}

## Config file validation

Many integrated development environments (IDEs) and editors support schema validation for your standalone agentgateway configuration file. 

The agentgateway schema is available as a [JSON schema](https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.json).

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
