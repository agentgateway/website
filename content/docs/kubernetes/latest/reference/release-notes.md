---
title: Release notes
weight: 20
---

Review the release notes for agentgateway.


## v2.2.0 {#v220}

Version 2.2 introduces major breaking changes for agentgateway, including new dedicated APIs, a split Helm installation, and documentation moved to agentgateway.dev. 

{{< callout type="info">}}
If you are currently running agentgateway with kgateway on version 2.1, a new installation is recommended.
{{< /callout >}}

If you choose to upgrade to version 2.2, review the following considerations.

- Upgrading the control plane automatically restarts any agentgateway data plane proxies.
- The custom resource APIs, default namespace, controller, and other settings are updated.

Continue reviewing the release notes to understand the changes from the previous version.

## 🔥 Breaking changes {#v22-breaking-changes}

Note that the previous 2.1 version of agentgateway on Kubernetes used the kgateway project as the control plane, as well as the kgateway APIs such as TrafficPolicy. In 2.2, these old kgateway APIs are no longer supported for agentgateway. 

{{< callout type="info">}}
For more details, review the [GitHub release notes in the kgateway repository](https://github.com/kgateway-dev/kgateway/releases/tag/v2.2.0).
{{< /callout >}}


### Dedicated agentgateway APIs and installation {#agentgateway-apis}

Agentgateway now has dedicated APIs and a separate installation from kgateway:

* New APIs in the `agentgateway.dev` API group
* New `AgentgatewayPolicy` API to replace `TrafficPolicy` for agentgateway policy configurations
* New `AgentgatewayParameters` API to replace GatewayParameters for agentgateway proxy configurations
* Split Helm installation with dedicated charts for agentgateway

Key changes include:

* Policies are now configured through `AgentgatewayPolicy` instead of `TrafficPolicy`
* `DirectResponse` for agentgateway is now only configurable through `AgentgatewayPolicy` instead of the separate `DirectResponse` CRD
* Agentgateway can no longer be configured with `GatewayParameters`, only with `AgentgatewayParameters`
* The controller name changed from `kgateway.dev/agentgateway` to `agentgateway.dev/agentgateway`
* `AgentgatewayParameters` `rawConfig` breaking change to allow configuring `binds` and other settings in `config.yaml` outside of its `config` section
* The default namespace for agentgateway is now `agentgateway-system` instead of `kgateway-system`

{{< callout type="info">}}
For a detailed comparison of agentgateway vs kgateway resources, including GatewayClass, controller names, Helm chart locations, and CRDs, see the [kgateway v2.2 release blog](https://kgateway.dev/blog/kgateway-v2.2-release-blog/).
{{< /callout >}}

### Feature gate for experimental Gateway API features {#experimental-feature-gate}

The `KGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES` environment variable gates experimental Gateway API features and APIs. This setting defaults to `false` and must be explicitly enabled to use experimental features such as XListenerSet, Route SessionPersistence, HTTPCORSFilter, and HTTPRouteRetry.

To enable these features, use a Helm values file or the `--set` flag during installation:

```yaml
controller:
  extraEnv:
    KGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES: "true"
```

Or use the Helm flag: `--set controller.extraEnv.KGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES=true`

### ExtAuth fail closed {#extauth-fail-closed}

Agentgateway ExtAuth policies now fail closed when the `backendRef` to the auth server is invalid. Previously, invalid backend references might have allowed requests through. Update your ExtAuth policies to ensure backend references are valid before upgrading.

### AI prompt guard API alignment {#ai-prompt-guard}

The AI prompt guard API is updated to align with other enums. The values changed from `MASK` to `Mask` and `REJECT` to `Reject`. These changes are enforced by CEL validation in the API. Update any existing prompt guard configurations accordingly.

## 🌟 New features {#v22-new-features}

### Performance and infrastructure

**Performance improvements**: The agentgateway control plane was refactored, improving performance by up to 25x.

**Multi-arch controller image support**: Agentgateway now supports multi-architecture controller images.

**Infrastructure options**:
* `Gateway.spec.addresses` support for configuring load balancer IP addresses
* `PodDisruptionBudget` and `HorizontalPodAutoscaler` options via `AgentgatewayParameters`
* Event reporting for agentgateway gateways that indicates when a gateway has NACKed an update

### AI and LLM support

**Model aliases**: Added `modelAliases` support to `AgentgatewayPolicy` to allow friendly model name aliases for your AI backends (for example, "fast" can map to "gpt-3.5-turbo").

**Provider support**:
* Added support for Azure OpenAI backends
* Added support for multiple AI backend route types including OpenAI Responses API, Anthropic token counting, and prompt caching configuration for Bedrock (enabling up to 90% cost reduction)
* Path-based API format routing (completions, messages, models, passthrough) to enable a single backend to support multiple LLM API formats based on request URL

**Canadian Social Insurance Number prompt guards**: Added support for detecting and guarding Canadian Social Insurance Numbers in prompts.

### MCP support

**MCP authentication**: MCP authentication enables OAuth 2.0 protection for MCP servers, helping to implement the MCP Authorization specification. Agentgateway can act as a resource server, validating JWT tokens and exposing protected resource metadata.

**Stateful/stateless session routing**: You can now configure the MCP session behavior for requests to be `Stateful` or `Stateless` on the `AgentgatewayBackend`. Behavior defaults to `Stateful` if not set.

**Multi-network support**: Added support for cross-network workload discovery and routing in ambient mode.

### Authentication and security

* **Basic auth, API key auth, and JWT auth**: Agentgateway proxies now support basic auth, API key auth, and JWT auth
* **Inline and remote JWKS support**: Define both inline and remote JWKS endpoints to automatically fetch and rotate keys from your identity provider on the `AgentgatewayPolicy`, including TLS options when connecting to a remote JWKS source
* **CSRF**: Configure CSRF policies using the `traffic` field in `AgentgatewayPolicy`
* **ExtAuth**: ExtAuth with HTTP support and configurable timeout

### Observability and TLS

**Tracing support**: Dynamically configure tracing for agentgateway using the `AgentgatewayPolicy` `frontend` field. See the [tracing setup guide](/docs/kubernetes/latest/observability/tracing/).

**Cipher suite configuration**: Configure cipher suites and min and max TLS version on the agentgateway proxy using the `spec.frontend.tls` fields in `AgentgatewayPolicy`.

### Ingress to Gateway API migration {#v22-ingress-migration}

If you are currently running [Ingress Nginx](https://kubernetes.github.io/ingress-nginx/) to support the Kubernetes Ingress API, the [ingress2gateway](https://github.com/kgateway-dev/ingress2gateway) tool can help you migrate to Gateway API by translating your existing Ingress manifests into Gateway, HTTPRoute, and implementation-specific policy resources. The tool can emit resources tailored for agentgateway. See the [agentgateway migration guide](/docs/kubernetes/latest/migrate/).

## 🗑️ Deprecated or removed features {#v22-removed-features}

### No support for kgateway APIs {#no-support-for-kgateway-apis}

As previously mentioned, the kgateway APIs are no longer supported for agentgateway version 2.2 and later.

### Inference Extension in 2.2.1

Version 2.2.0 includes an inference plugin regression due to [GitHub issue #13456](https://github.com/kgateway-dev/kgateway/issues/13456). Users of this plugin should not upgrade to v2.2.0 and should instead wait for the upcoming v2.2.1 patch release.

## 🔮 Future releases

Note that version 2.2 of agentgateway on Kubernetes is the **last version to use the kgateway control plane**. The next release plans to:
- Migrate the control plane to the `agentgateway` project.
- Standardize the versioning for standalone agentgateway and agentgateway on Kubernetes.

As such, the documentation in the [agentgateway.dev](https://agentgateway.dev/docs/kubernetes/latest/) website is for version 2.2 and later. Version 2.1 documentation is no longer available, as it was previously on the [kgateway.dev](https://kgateway.dev/docs/) website.
