Deploy agentgateway on a new Google Kubernetes Engine (GKE) cluster with [Cluster Toolkit](https://docs.cloud.google.com/cluster-toolkit/docs/overview). Cluster Toolkit is an open-source tool that uses customizable [blueprints](https://docs.cloud.google.com/cluster-toolkit/docs/setup/cluster-blueprint) to provision clusters on Google Cloud. Use this approach to manage the cloud infrastructure and gateway configuration together.

The blueprint is currently on Cluster Toolkit's `develop` branch. Clone that branch before following the [upstream deployment guide](https://github.com/GoogleCloudPlatform/cluster-toolkit/blob/develop/community/examples/agentgateway-gke/README.md#deploy). The blueprint README is the source of truth for prerequisites, architecture, supported versions, configuration options, validation, troubleshooting, and cleanup.

To install agentgateway in an existing cluster, use the [Helm installation guide]({{< link-hextra path="/documentation/install/helm/" >}}).
