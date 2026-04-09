Review the following information about supported release versions for the [agentgateway project](https://github.com/agentgateway/agentgateway).

## Supported versions

| agentgateway | Release date | Kubernetes | Gateway API`*` | Helm | Istio`†` |
|----------|--------------|------------|----------------|------|----------|
| 1.1.x | 09 Apr 2026 | 1.31 - 1.35 | 1.3 - 1.5 | >= 3.12 | 1.23 - 1.29 |
| 1.0.x | 16 Mar 2026 | 1.31 - 1.35 | 1.3 - 1.5 | >= 3.12 | 1.23 - 1.29 |
| 2.2.x | 09 Feb 2026 | 1.31 - 1.35 | 1.2 - 1.4 | >= 3.12 | 1.23 - 1.27 |

`*` Gateway API versions: The agentgateway project is conformant to the Kubernetes Gateway API specification. For more details, see the [Gateway API docs](https://gateway-api.sigs.k8s.io/implementations/#agent-gateway-with-kgateway) and agentgateway conformance report per version, such as Gateway API [v1.5.0](https://github.com/kubernetes-sigs/gateway-api/tree/main/conformance/reports/v1.5.0/agentgateway-agentgateway).

`†` Istio versions: Istio must run on a compatible version of Kubernetes. For example, Istio 1.27 is tested, but not supported, on Kubernetes 1.28. For more information, see the [Istio docs](https://istio.io/latest/docs/releases/supported-releases/). 

## Release development {#release}

New features for agentgateway are developed on `main` before being part of a release. Tags are created off of `main` for each release, such as `v1.0.0`.

### Release process {#release-process}

Development of a quality stable release on `main` typically follows this process:

1. New feature development is suspended on `main`.
2. Release candidates are created, such as `{{< reuse "/agw-docs/versions/short.md" >}}.0-rc.1`, `{{< reuse "/agw-docs/versions/short.md" >}}.0-rc.2`, and so on.
3. A full suite of tests is performed for each release candidate. Testing includes all documented workflows, a test matrix of all supported platforms, and more.
4. Documentation for that release is prepared, vetted, and staged.
5. The stable minor version is released as part of a tag, such as `v1.0.0`.
6. Feature development on `main` is resumed.

### Feature development on main branch {#release-main}

Feature development is performed on the `main` branch. Merges to `main` trigger CI tests and linting, but do not automatically produce published development builds. Releases are tag-driven: a build is published only when a version tag (such as `v1.0.0`) is pushed or a release is triggered manually.

### Backports {#release-backport}

New features are neither developed nor backported to long-term support branches. However, critical patches, bug fixes, and documentation updates are released as needed.

## Experimental features in Gateway API {#experimental-features}

{{< reuse "/agw-docs/snippets/k8sgwapi-exp.md" >}}
