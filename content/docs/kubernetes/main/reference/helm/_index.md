---
title: Helm value reference
weight: 20
description: Review Helm values for agentgateway Helm charts.
---

## Download the Helm chart {#download}

You can download the Helm chart to review the Helm values that are supported. 

1. Download the Helm chart as an archive to your local machine. 
   ```sh
   helm pull {{< reuse "agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
   ```

2. Extract the files from the downloaded archive. 
   ```sh
   tar -xvf agentgateway-{{< reuse "agw-docs/versions/helm-version-flag.md" >}}.tgz
   ```

3. Open the Helm values file. 
   ```sh
   open agentgateway/values.yaml
   ```

## Helm charts

Review the documentation for the following Helm charts.

