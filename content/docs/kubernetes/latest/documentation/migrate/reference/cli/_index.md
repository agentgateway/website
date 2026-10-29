---
title: "CLI"
description: CLI commands and flags for the ingress2gateway tool
weight: 10
---
This page focuses on the commands you’ll use most often.

## `print`

Translates input manifests and prints generated resources. Without `--input-file`, the command reads from the cluster using the current kubeconfig context.

Typical usage:

```bash
ingress2gateway print   --providers=ingress-nginx   --emitter=agentgateway   --input-file ./ingress.yaml
```

Common flags in v0.5.0:

| Flag | Description |
| --- | --- |
| `--input-file` | Read manifests from a file. Repeat the flag to read multiple files. |
| `--ingress-nginx-ingress-class` | Select the source Ingress class. Defaults to `nginx`. |
| `-n`, `--namespace` | Restrict cluster reads to a namespace. |
| `-A`, `--all-namespaces` | Read matching resources across all namespaces. |
| `-o`, `--output` | Choose `yaml`, `json`, or `kyaml` output. Defaults to `yaml`. |
| `--allow-experimental-gw-api` | Include experimental Gateway API fields in the output. |
| `--no-color` | Disable ANSI color codes in notifications. |

Output is written to stdout; use shell redirection to save it to a file.

## `version`

Prints version information.

```bash
ingress2gateway version
```

## Help

For the complete flag reference for your build:

```bash
ingress2gateway --help
ingress2gateway print --help
```
