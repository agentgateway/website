{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} has two main deployments modes, called `standalone` and `kubernetes` throughout the documentation.

| Use case | Standalone | Kubernetes |
| --- | --- | --- |
| Where to run | Anywhere | Kubernetes cluster |
| CI/CD structure | ClickOps | GitOps |
| Team style | Single developers, small teams, traditional gateway or non-Kubernetes infrastructure | Larger teams with shared Kubernetes infrastructure |
| Architecture | Binary runs a proxy instance, optional database to write config | Managed Kubernetes control plane, proxy gateway, optional database integration |
| Installation methods | <ul><li>Binary download</li><li>Docker container</li><li>Helm chart for a single Kubernetes Deployment</li></ul> | Two Helm charts for CRDs and control plane |
| User interface | <ul><li>Admin UI that can edit config</li><li>`agentgateway` binary</li><li>`agctl` CLI</li></ul> | <ul><li>Read-only Admin UI</li><li>Kubernetes CRs</li><li>`agctl` CLI</li></ul> |
| Configuration | Agentgateway configuration file | Agentgateway CRs and Kubernetes Gateway API |
| Docs section | [**Docs > Standalone**](https://agentgateway.dev/docs/standalone/) | [**Docs > Kubernetes**](https://agentgateway.dev/docs/kubernetes/) |

**Standalone** mode refers to the agentgateway binary, a quick way to get started and run anywhere. You can deploy standalone agentgateway as a binary download, Docker container, or via a Helm chart for a simple Kubernetes Deployment. In standalone mode, the agentgateway admin UI can edit your configuration file, lending itself well to developers, simple ClickOps deployments, and more traditional, non-Kubernetes gateway infrastructure. For more information, make sure that you are in the .

**Kubernetes** mode refers to the agentgateway control plane and set of custom resources that works with the Kubernetes Gateway API. You install Kubernetes mode with two CRD and control plane Helm charts in a Kubernetes cluster. As such, it is particularly well suited for teams that already have cloud-native, GitOps-driven Kubernetes infrastructure. For more information, make sure that you are in the **Docs > Kubernetes** section of the docs, `https://agentgateway.dev/docs/kubernetes/`.
