---
title: Static Configuration
weight: 10
description:
---

While most configurations are dynamic, and automatically updating as you make changes, a few configurations are staticly configured at startup.
These are configured under the `config` section.

## Configuration File Schema

The following table describes the full configuration file schema.

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.md" 
   section="Configuration File Schema"
   exclude="^\\|.(binds|frontendPolicies|policies|services|workloads|backends)"
%}}

The full configuration schema can be found [here](/docs/reference/configuration).