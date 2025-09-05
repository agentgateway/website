---
title: Overview
weight: 10
description:
next: /docs/configuration/listeners
---

Manage agentgateway through a configuration file. Supported file formats are JSON and YAML.

## Configuration sections {#sections}

Agentgateway configuration has a few top level sections:

* `config` configures top level settings. These options are the only ones that are not dynamically configured.
* `binds` provides the entry point to all routing configuration.
* `services` and `workloads` can be used for very advanced cases where backends need to be represented as complex objects rather than simple URLs. However, it is recommended to [use kgateway](https://kgateway.dev/docs/agentgateway/) for these purposes. Kgateway simplifies the management of agentgateway proxy resources for Kubernetes-based workloads.

For an overview of the configuration fields, review the [Getting Started](/docs/quickstart/#basic-config) guide.

### Example configuration file {#example-file}

```yaml
cat <<EOF > config.yaml
{{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" >}}
EOF
```

## Update configuration {#add}

To update configuration, you can write to the configuration file or use the agentgateway UI.

* **Write to the file**: Most changes that you make to the file are automatically picked up by agentgateway.
* **UI**: The agentgateway UI overwrites the contents of the configuration file. Note that any comments that you add to the file are wiped out!

## Run your configuration {#run}

To run agentgateway, install the agentgateway binary and pass the file with the `-f` option, such as the following example command.

```shell
agentgateway -f config.yaml
```
