---
title: Configuration basics
weight: 10
description: 
---

Agentgateway is managed by a configuration file (JSON/YAML).
Most changes to the configuration are automatically picked up automatically.
Changes from the UI will modify the contents in the file (note, however, that this will wipe out any comments you may have added!)

To run agentgateway, simple pass the file with `-f`, such as:

```shell
agentgateway -f config.yaml
```

## Configuration sections

Agentgateway configuration has a few top level sections:

* `config` configures top level settings. These are the only options that are not dynamically configured.
* `binds` provides the entry point to all routing configuration.
* `services` and `workloads` can be used for very advanced cases where backends need to be represented as complex objects rather than simple URLs. However, it is recommended to [use kgateway](https://kgateway.dev/docs/agentgateway/) for these purposes.

The [Getting Started](/docs/quickstart/#basic-config) documentation contains an overview of these fields.
