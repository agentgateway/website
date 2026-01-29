---
title: "Agentgateway"
description: "How ingress-nginx annotations map to Gateway API + AgentgatewayPolicy resources"
weight: 30
---

The Agentgateway Emitter supports generating **Gateway API** resources plus **agentgateway**-specific extensions
from Ingress manifests using:

- **Provider**: `ingress-nginx`

**Note:** All other providers are ignored by the emitter.

## What it outputs

- Standard **Gateway API** objects (Gateways, HTTPRoutes, etc.)
- Agentgateway extension objects emitted as unstructured resources, e.g. **AgentgatewayPolicy**.

The emitter also ensures that any generated Gateway resources use:

- `spec.gatewayClassName: agentgateway`

## Usage

Ingress2gateway reads Ingress resources from a Kubernetes cluster or a file. It outputs the equivalent
Gateway API and agentgateway-specific resources in YAML or JSON format to stdout. The simplest case is to convert
all ingresses from the ingress-nginx provider:

```shell
ingress2gateway print --providers=ingress-nginx --emitter=agentgateway
```

This command:

1. Reads the kubeconfig file to extract cluster credentials and the current active namespace.
2. Searches for ingress-nginx resources in that namespace.
3. Converts them to Gateway API resources (Gateways, HTTPRoutes) and AgentgatewayPolicy resources where applicable.

## Options

### `print` command

| Flag           | Default Value           | Required | Description                                                  |
| -------------- | ----------------------- | -------- | ------------------------------------------------------------ |
| all-namespaces | False                   | No       | If present, list the requested object(s) across all namespaces. Namespace in the current context is ignored even if specified with --namespace. |
| input-file     |                         | No       | Path to the manifest file. When set, the tool reads ingresses from the file instead of from the cluster. Supported files are yaml and json. |
| namespace      |                         | No       | If present, the namespace scope for the invocation.           |
| output         | yaml                    | No       | The output format, either yaml or json.                       |
| providers      |  | Yes       | Comma-separated list of providers (only ingress-nginx is supported). |
| emitter      | standard | No       | The emitter to use for generating Gateway API resources (supported values: standard, agentgateway). |
| kubeconfig     |                         | No       | The kubeconfig file to use when talking to the cluster. If the flag is not set, a set of standard locations can be searched for an existing kubeconfig file. |

## Conversion of Ingress resources to Gateway API

### Processing Order and Conflicts

Ingress resources are processed in a defined order to ensure deterministic
Gateway API configuration.
This order also determines precedence of Ingress resources and routes in case
of conflicts.

Ingress resources with the oldest creation timestamp are sorted first and therefore
given precedence. If creation timestamps are equal, sorting is done based
on the namespace/name of the resources. If an Ingress rule conflicts with another
(e.g. same path match but different backends), an error is reported for the
one that sorts later.

Since the Ingress v1 spec does not define conflict resolution, this tool
adopts the following rules, which are similar to the [Gateway API conflict resolution
guidelines](https://gateway-api.sigs.k8s.io/concepts/guidelines/#conflicts).

### Ingress resource fields to Gateway API fields

Given a set of Ingress resources, `ingress2gateway` generates a Gateway with
various HTTP and HTTPS listeners as well as HTTPRoutes that represent equivalent
routing rules.

| Ingress Field                   | Gateway API configuration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingressClassName`              | If configured on an Ingress resource, the generated Gateway uses `spec.gatewayClassName: agentgateway`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `defaultBackend`                | If present, this configuration generates a Gateway Listener with no `hostname` specified as well as a catchall HTTPRoute that references this listener. The backend specified here is translated to a HTTPRoute `rules[].backendRefs[]` element.                                                                                                                                                                                                                                                                                                                                                         |
| `tls[].hosts`                   | Each host in an IngressTLS results in a HTTPS Listener on the generated Gateway with the following: `listeners[].hostname` = host as described, `listeners[].port` = `443`, `listeners[].protocol` = `HTTPS`, `listeners[].tls.mode` = `Terminate`                                                                                                                                                                                                                                                                                                                                                            |
| `tls[].secretName`              | The secret specified here is referenced in the Gateway HTTPS Listeners mentioned above with the field `listeners[].tls.certificateRefs`. Each Listener for each host in an IngressTLS gets this secret.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `rules[].host`                  | If non-empty, each distinct value for this field in the provided Ingress resources results in a separate Gateway HTTP Listener with matching `listeners[].hostname`. `listeners[].port` is set to `80` and `listeners[].protocol` to `HTTP`. In addition, Ingress rules with the same hostname generate HTTPRoute rules in a HTTPRoute with `hostnames` containing it as the single element. If empty, similar to the `defaultBackend`, a Gateway Listener with no hostname configuration is generated (if one does not exist) and routing rules are generated in a catchall HTTPRoute. |
| `rules[].http.paths[].path`     | This field translates to a HTTPRoute `rules[].matches[].path.value` configuration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `rules[].http.paths[].pathType` | This field translates to a HTTPRoute `rules[].matches[].path.type` configuration. Ingress `Exact` = HTTPRoute `Exact` match. Ingress `Prefix` = HTTPRoute `PathPrefix` match.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `rules[].http.paths[].backend`  | The backend specified here is translated to a HTTPRoute `rules[].backendRefs[]` element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Supported Annotations

The agentgateway emitter projects many ingress-nginx annotations into **AgentgatewayPolicy** resources. Policies are either HTTPRoute-scoped (traffic behavior) or Service-scoped (backend behavior).

### Traffic Behavior

#### SSL Redirect

- `nginx.ingress.kubernetes.io/ssl-redirect`
- `nginx.ingress.kubernetes.io/force-ssl-redirect`

When either annotation is truthy, the emitter **splits** the generated HTTPRoute into two routes:

- **HTTP redirect route** (bound to the Gateway HTTP listener): each rule includes a `RequestRedirect` filter with `scheme: https`, `statusCode: 301`, and no `backendRefs`.
- **HTTPS backend route** (bound to the Gateway HTTPS listener): preserves the original backendRefs; any existing `RequestRedirect` filters are removed.

Naming: HTTP redirect route `<original-http-route-name>-http-redirect`, HTTPS backend route `<original-http-route-name>-https`. Redirect behavior uses only Gateway API objects (no agentgateway extensions).

#### Rewrite Target

- `nginx.ingress.kubernetes.io/rewrite-target`
- `nginx.ingress.kubernetes.io/use-regex: "true"` (for regex/capture-group behavior)

Mapped into **AgentgatewayPolicy** using agentgateway’s `Traffic.Transformation` model by setting the HTTP pseudo-header `:path` in `spec.traffic.transformation.request.set`:

- **Non-regex rewrite:** `rewrite-target: /new` → `:path` set to a literal string value (e.g. a CEL string literal such as `"/new"`).
- **Regex rewrite:** `rewrite-target: /new/$1` with `use-regex: "true"` → `:path` set using a CEL `regexReplace(...)` expression; the pattern is derived from the HTTPRoute rule path.

Agentgateway uses CEL expressions, so literal strings appear as quoted CEL string literals in YAML.

#### CORS

- `nginx.ingress.kubernetes.io/enable-cors`
- `nginx.ingress.kubernetes.io/cors-allow-origin`
- `nginx.ingress.kubernetes.io/cors-allow-methods`
- `nginx.ingress.kubernetes.io/cors-allow-headers`
- `nginx.ingress.kubernetes.io/cors-expose-headers`
- `nginx.ingress.kubernetes.io/cors-allow-credentials`
- `nginx.ingress.kubernetes.io/cors-max-age`

Mapped into **AgentgatewayPolicy** using agentgateway’s `Traffic.Cors` model (inlining the Gateway API `HTTPCORSFilter`). CORS is projected only when `enable-cors` is truthy **and** at least one value is present in `cors-allow-origin`. When CORS is projected, the emitter also adds a Gateway API `ResponseHeaderModifier` filter to the HTTPRoute rules to strip common CORS response headers from the upstream response so that the gateway policy controls effective CORS behavior.

#### Basic Authentication

- `nginx.ingress.kubernetes.io/auth-type` (supported: `basic`)
- `nginx.ingress.kubernetes.io/auth-secret`
- `nginx.ingress.kubernetes.io/auth-secret-type` (supported: `auth-file`)

Mapped into **AgentgatewayPolicy** using agentgateway’s `Traffic.BasicAuthentication` model: `auth-secret` → `AgentgatewayPolicy.spec.traffic.basicAuthentication.secretRef.name`. The emitter projects only the `secretRef` form. Agentgateway expects the Secret to contain a key named **`.htaccess`** with htpasswd-formatted content; ingress-nginx (auth-file) typically uses the key **`auth`**. To use the same Secret for both, create a dual-key Secret with both `auth` and `.htaccess` containing the same htpasswd content. The emitter may emit an **INFO** notification about this key difference.

#### External Authentication

- `nginx.ingress.kubernetes.io/auth-url`
- `nginx.ingress.kubernetes.io/auth-response-headers`

Mapped into **AgentgatewayPolicy** using agentgateway’s `Traffic.ExtAuth` model: `auth-url` → `AgentgatewayPolicy.spec.traffic.extAuth.backendRef` (parsed from URL host as a Kubernetes Service `*.svc[.cluster.local]`); path (when not `/`) → `spec.traffic.extAuth.http.path` (CEL expression); `auth-response-headers` → `spec.traffic.extAuth.http.allowedResponseHeaders[]`. Only in-cluster auth URLs that resolve to a Kubernetes Service are supported; the emitter uses the HTTP ext auth mode.

#### Request Timeouts

- `nginx.ingress.kubernetes.io/proxy-send-timeout`
- `nginx.ingress.kubernetes.io/proxy-read-timeout`

Mapped into **AgentgatewayPolicy** using agentgateway’s `Traffic.Timeouts` model. If both annotations are set, the emitter uses the **larger** of the two values for `spec.traffic.timeouts.request`.

#### Local Rate Limiting

- `nginx.ingress.kubernetes.io/limit-rps`
- `nginx.ingress.kubernetes.io/limit-rpm`
- `nginx.ingress.kubernetes.io/limit-burst-multiplier`

Mapped into **AgentgatewayPolicy** using agentgateway’s `LocalRateLimit` model: `limit-rps` → requests per second; `limit-rpm` → requests per minute; `limit-burst-multiplier` (when > 1) → burst.

### Backend Behavior

#### Backend TLS

- `nginx.ingress.kubernetes.io/proxy-ssl-secret`
- `nginx.ingress.kubernetes.io/proxy-ssl-server-name`
- `nginx.ingress.kubernetes.io/proxy-ssl-name`
- `nginx.ingress.kubernetes.io/proxy-ssl-verify`

Mapped into **AgentgatewayPolicy** using agentgateway’s `BackendSimple.TLS` model: `proxy-ssl-name` → `spec.backend.tls.sni`; `proxy-ssl-verify: "off"` → `spec.backend.tls.insecureSkipVerify = All`; `proxy-ssl-secret` → `spec.backend.tls.mtlsCertificateRef[0].name`. Backend TLS is emitted as **one AgentgatewayPolicy per referenced backend Service**. If `proxy-ssl-secret` is given as `namespace/name`, the emitter uses only `name` (Secret must be in the same namespace as the policy).

#### Proxy Connect Timeout

- `nginx.ingress.kubernetes.io/proxy-connect-timeout`

Projected into a **Service-targeted** AgentgatewayPolicy: `AgentgatewayPolicy.spec.backend.tcp.connectTimeout`. The policy targets the covered Service backends via `spec.targetRefs`. If a route-level request timeout is also set, the emitter only projects `proxy-connect-timeout` when it is less than or equal to the projected request timeout.

## AgentgatewayPolicy Projection

Annotations for rate limit, timeouts, CORS, rewrite target, basic auth, and ext auth are converted into **AgentgatewayPolicy** resources. The emitter uses two shapes:

- **HTTPRoute-scoped policies** for traffic-level behavior (rate limit, request timeouts, CORS, rewrite target, basic auth, ext auth).
- **Service-scoped policies** for backend behavior (backend TLS and proxy connect timeout).

### Naming

- Traffic policies: `metadata.name: <ingress-name>`, `metadata.namespace: <route-namespace>`.
- Backend TLS policies: `metadata.name: <service-name>-backend-tls`, `metadata.namespace: <route-namespace>`.
- Proxy connect timeout policies: `metadata.name: <service-name>-backend-connect-timeout`, `metadata.namespace: <route-namespace>`.

### Attachment Semantics

If a policy covers **all** backends of the generated HTTPRoute, it is attached using `spec.targetRefs` to the HTTPRoute. If a policy would cover only **some** (rule, backendRef) pairs, the emitter **returns an error** and does not emit agentgateway resources for that Ingress, because agentgateway does not support attaching AgentgatewayPolicy via per-backend HTTPRoute `ExtensionRef` filters. To avoid rejected or non-functional manifests, the emitter fails fast. Workarounds: split the source Ingress so each HTTPRoute can be fully covered by a policy, or adjust annotations so the policy applies uniformly. For backend TLS, the emitted Service-targeted policy applies cleanly without per-backend HTTPRoute filters.

### Summary of policy types

| Annotation category   | Agentgateway resource | Scope        |
|------------------------|-----------------------|--------------|
| Traffic behavior       | AgentgatewayPolicy    | HTTPRoute    |
| Backend TLS / connect  | AgentgatewayPolicy    | Service      |

## Notifications

Some conversions require follow-up user action that cannot be expressed safely as emitted manifests. The agentgateway emitter emits **INFO** notifications on the CLI in those cases. For example, when projecting **Basic Authentication**, the emitter may notify that ingress-nginx expects htpasswd under Secret key `auth` while agentgateway expects key `.htaccess`.

## Limitations

- Only the **ingress-nginx provider** is currently supported by the Agentgateway emitter.
- **Regex path matching** is not currently implemented for agentgateway output.
- Agentgateway does not support per-backend `HTTPRoute` `ExtensionRef` filters for policies; partial coverage leads to an error.

## Supported but not translated

The following annotations have equivalents in agentgateway but are not (as of yet) translated by this tool:

- `nginx.ingress.kubernetes.io/auth-proxy-set-headers` — supported in AgentgatewayPolicy (e.g. `spec.traffic.extAuth.httpService.authorizationRequest.headersToAdd`).

## Future work

The code defines GVKs for additional agentgateway extension types (e.g. `AgentgatewayBackend`), but they are not yet emitted by the current implementation.
