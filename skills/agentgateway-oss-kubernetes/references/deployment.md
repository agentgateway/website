# Deployment and lifecycle — OSS Agentgateway Kubernetes controller

## Establish ownership before applying

Inspect the selected context, cluster version, namespaces, relevant Helm releases/GitOps objects, Gateway API and product CRDs, GatewayClasses, and existing routes. Use explicit `--context` / `--kube-context` and namespace/release names. Do not change the global kube context or upgrade a shared controller merely to follow a newer example. If the target cluster is ambiguous, ask for it while preparing version/source checks.

An explicit local-kind setup request can authorize creating a new cluster, but a request for YAML alone does not. Keep creation and cleanup scoped to task-owned resources. Installing or replacing cluster-scoped CRDs can affect other users; determine that impact instead of treating namespace selection as isolation.

## OSS controller installation

Read [Helm installation](https://agentgateway.dev/docs/kubernetes/latest/documentation/install/helm.md) and its version-support links. The checked docs use separate `agentgateway-crds` and `agentgateway` charts under `oci://cr.agentgateway.dev/charts`. These are controller charts; a standalone Helm chart packages a configuration file and is outside this skill.

Inspect installed Gateway API and Agentgateway CRDs and their release owners before installing. Select standard versus experimental Gateway API resources only as required by the requested feature. Pin a supported release and verify its GatewayClass/controller identifiers; do not reuse the Enterprise workshop's charts, license, or controllerName. Render values locally first, then validate against the target CRDs where available.

## Built-in UI

Read [UI](https://agentgateway.dev/docs/kubernetes/latest/documentation/observability/ui.md). The current documented proxy UI is read-only in controller mode: it reflects controller-delivered configuration. Modify Kubernetes resources through their existing owner; do not promise that the standalone UI's model/key editors work here.

Discover the actual proxy workload and admin port, start a loopback port-forward in a persistent task-owned session, and verify the host URL before returning it. The documented example uses proxy port 15000 and `/ui/`; do not assume that deployment name, namespace, or local port is free. The port-forward must remain running for the URL to work. Client Setup generates client settings and does not create routing or credentials. No Enterprise management chart is needed for the OSS diagnostic UI.

This diagnostic UI has no separate per-user admin RBAC. Recommend restricting `pods/portforward` and proxy/admin access to the intended operator group through Kubernetes RBAC and the customer's access controls. If a shared browser URL is needed, verify an IdP and role checks at a trusted access layer for the selected release; do not expose the unauthenticated admin port or call every authenticated viewer an administrator. Keep gateway traffic authorization separate from operator UI access.


## Configure and verify the resource chain

Use the selected release's documented sequence. Inspect GatewayClass acceptance, Gateway/listener status, route/model attachment, backend references, policy targets and current observed generation. Verify cross-namespace permissions and selector scope. Do not use broad grants or `allowedRoutes` across all namespaces unless that matches the requested tenancy.

Check the proxy's delivered configuration and relevant logs for rejections. On releases with model resources, enabling their built-in LLM endpoints can change routing for existing HTTPRoutes; review that before applying a listener update. Ensure the path the SDK actually sends matches the configured route, including prefixes/rewrites and `/v1` where required. Model names are configuration-dependent, not automatically interchangeable between providers.

For AWS or other cloud credentials, distinguish the operator's CLI identity from the proxy workload's identity. Use the existing supported workload identity or explicit Secret delivery selected by the customer. Do not assume local SSO cache files exist in the Pod. Preserve trust verification, credential refresh, and least-privilege scope needed by the chosen models.

## Change and rollback

Keep manifests/values and rollback instructions in the customer's existing repository or requested output directory. Preview the targeted diff/render before applying. For an existing release, merge changes into the authoritative values; do not reset unrelated configuration. Do not assume uninstalling a release or deleting CRDs is a safe rollback. Preserve budget state, Secrets, PVCs, and shared services. Stop only port-forwards and test workloads created for this task.
