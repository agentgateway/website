---
title: "Ingress NGINX"
description: "How ingress-nginx annotations map to Gateway API + agentgateway resources"
weight: 30
---

The `ingress-nginx` provider defines the source resources to be translated, e.g. an Ingress resource with Ingress NGINX-specific annotations.

**Note:** Some annotations may be translated into agentgateway resources or user-facing notifications.

## Supported Annotations

The `ingress-nginx` provider currently supports an Ingress with the following annotations.

### Canary / Traffic Shaping

- `nginx.ingress.kubernetes.io/canary`: If set to `true`, enables weighted backends.

- `nginx.ingress.kubernetes.io/canary-by-header`: Specifies the header name used to generate an HTTPHeaderMatch.

- `nginx.ingress.kubernetes.io/canary-by-header-value`: Specifies the exact header value to match.

- `nginx.ingress.kubernetes.io/canary-by-header-pattern`: Specifies a regex pattern used in the header match.

- `nginx.ingress.kubernetes.io/canary-weight`: Specifies the backend weight for traffic shifting.

- `nginx.ingress.kubernetes.io/canary-weight-total`: Defines the total weight used when calculating backend percentages.

---

### Request / Body Size

- `nginx.ingress.kubernetes.io/client-body-buffer-size`: Sets the maximum request body size when `proxy-body-size` is not present. **Note:** The agentgateway emitter does not currently project body/buffer size to AgentgatewayPolicy.

- **Note (regex-mode constraint):** Ingress NGINX session cookie paths do not support regex. If regex-mode is enabled for a host (via `use-regex: "true"` or
  `rewrite-target`) and cookie affinity is used, `session-cookie-path` must be set; the provider validates this and emits an error if it is missing.

- `nginx.ingress.kubernetes.io/proxy-body-size`: Sets the maximum allowed request body size. Takes precedence over `client-body-buffer-size`. **Note:** The agentgateway emitter does not currently project body/buffer size to AgentgatewayPolicy.

---

### CORS

- `nginx.ingress.kubernetes.io/enable-cors`: Enables CORS policy generation. When set to "true", enables CORS handling for the Ingress.
  For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.cors`.
- `nginx.ingress.kubernetes.io/cors-allow-origin`: Comma-separated list of origins (e.g. "https://example.com, https://another.com").
  For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.cors.allowOrigins`.
- `nginx.ingress.kubernetes.io/cors-allow-credentials`: Controls whether credentials are allowed in cross-origin requests ("true" / "false").
  For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.cors.allowCredentials`.
- `nginx.ingress.kubernetes.io/cors-allow-headers`: A comma-separated list of allowed request headers. For agentgateway,
  this maps to `AgentgatewayPolicy.spec.traffic.cors.allowHeaders`.
- `nginx.ingress.kubernetes.io/cors-expose-headers`: A comma-separated list of HTTP response headers that can be exposed to client-side
  scripts in response to a cross-origin request. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.cors.exposeHeaders`.
- `nginx.ingress.kubernetes.io/cors-allow-methods`: A comma-separated list of allowed HTTP methods (e.g. "GET, POST, OPTIONS").
  For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.cors.allowMethods`.
- `nginx.ingress.kubernetes.io/cors-max-age`: Controls how long preflight responses may be cached (in seconds). For the agentgateway
  implementation, this maps to `AgentgatewayPolicy.spec.traffic.cors.maxAge`.

### Rate Limiting

- `nginx.ingress.kubernetes.io/limit-rps`: Requests per second limit. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.rateLimit.local` (requests, unit: Seconds).

- `nginx.ingress.kubernetes.io/limit-rpm`: Requests per minute limit. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.rateLimit.local` (requests, unit: Minutes).

- `nginx.ingress.kubernetes.io/limit-burst-multiplier`: Burst multiplier for rate limiting. For agentgateway, this maps to `burst` in the same `rateLimit.local` entry.

---

### Timeouts

- `nginx.ingress.kubernetes.io/proxy-send-timeout`: Controls the request timeout. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.timeouts.request`.

- `nginx.ingress.kubernetes.io/proxy-read-timeout`: Controls stream idle timeout. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.timeouts.request`. If both are set, the emitter uses the larger value.

---

### External Auth

- `nginx.ingress.kubernetes.io/auth-url`: Specifies the URL of an external authentication service. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.extAuth` (backendRef from URL host; only in-cluster `*.svc` URLs are supported).
- `nginx.ingress.kubernetes.io/auth-response-headers`: Comma-separated list of headers to pass to backend once authentication request completes. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.extAuth.http.allowedResponseHeaders`.

### Basic Auth

- `nginx.ingress.kubernetes.io/auth-type`: Must be set to `"basic"` to enable basic authentication. For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.basicAuthentication`.
- `nginx.ingress.kubernetes.io/auth-secret`: Specifies the secret containing basic auth credentials in `namespace/name` format (or just `name` if in the same namespace). For agentgateway, this maps to `AgentgatewayPolicy.spec.traffic.basicAuthentication.secretRef.name`. Agentgateway expects the Secret key **`.htaccess`** (ingress-nginx often uses `auth`); the emitter may emit an INFO notification about this.
- `nginx.ingress.kubernetes.io/auth-secret-type`: **Only `"auth-file"` is supported** (default). The secret must contain an htpasswd file in the key `"auth"`. Only SHA hashed passwords are supported. For agentgateway, the emitter projects only the secretRef form; agentgateway expects key `.htaccess`.

---

### Backend Protocol

- `nginx.ingress.kubernetes.io/backend-protocol`: Indicates the L7 protocol that is used to communicate with the proxied backend.
  - **Supported values (recorded):** `GRPC`, `GRPCS` — the provider records protocol intent; the agentgateway emitter does **not** currently emit AgentgatewayBackend or Service resources for this. It may emit an **INFO** notification with a `kubectl patch` command to set `spec.ports[].appProtocol` on the existing Service.
  - **Values treated as default HTTP/1.x (no-op):** `HTTP`, `HTTPS`, `AUTO_HTTP`
  - **Unsupported values (rejected):** `FCGI` (and others)

---

### Backend (Upstream) Configuration

- `nginx.ingress.kubernetes.io/proxy-connect-timeout`: Controls the upstream connection timeout. For agentgateway,
  this maps to `AgentgatewayPolicy.spec.backend.tcp.connectTimeout` (per-Service policy targeting the backend Service).
- `nginx.ingress.kubernetes.io/load-balance`: Sets the algorithm to use for load balancing. The only supported value is `round_robin`. **Note:** The agentgateway emitter does not currently project this to AgentgatewayPolicy.

**Note:** For agentgateway, if multiple Ingress resources reference the same Service with different `proxy-connect-timeout` values, ingress2gateway emits warnings; the emitter produces one AgentgatewayPolicy per Service and conflicting values may result in warnings.

---

### Backend TLS

- `nginx.ingress.kubernetes.io/proxy-ssl-secret`: Specifies a Secret containing client certificate (`tls.crt`), client key (`tls.key`), and optionally CA certificate (`ca.crt`) in PEM format. The secret name can be specified as `secretName` (same namespace) or `namespace/secretName`. For agentgateway, this maps to `AgentgatewayPolicy.spec.backend.tls.mtlsCertificateRef[0].name` (emitter uses only the name; Secret must be in the same namespace as the policy).

- `nginx.ingress.kubernetes.io/proxy-ssl-verify`: Enables or disables verification of the proxied HTTPS server certificate. Values: `"on"` or `"off"` (default: `"off"`). For agentgateway, `"off"` maps to `AgentgatewayPolicy.spec.backend.tls.insecureSkipVerify: All`; when verification is on, the emitter does not set `insecureSkipVerify` and configures mTLS via `mtlsCertificateRef` when a secret is provided.

- `nginx.ingress.kubernetes.io/proxy-ssl-name`: Overrides the server name used to verify the certificate of the proxied HTTPS server. This value is also passed through SNI. For agentgateway, this maps to `AgentgatewayPolicy.spec.backend.tls.sni`.

- `nginx.ingress.kubernetes.io/proxy-ssl-server-name`: When set to `"on"`, enables SNI; the SNI value still comes from `proxy-ssl-name`. For agentgateway, the emitter projects SNI via `proxy-ssl-name`.

**Note:** For agentgateway, backend TLS is emitted as one **AgentgatewayPolicy per backend Service** (name `<service-name>-backend-tls`), targeting the Service via `spec.targetRefs`. Conflicting settings for the same Service may result in warnings.

---

### Session Affinity

- `nginx.ingress.kubernetes.io/affinity`: Enables and sets the affinity type in all Upstreams of an Ingress. The only affinity type available for NGINX is "cookie". **Note:** The **agentgateway emitter does not support session affinity.** It does not emit AgentgatewayPolicy or equivalent for cookie affinity. Other emitters (e.g. kgateway) may map this to BackendConfigPolicy/ringHash.

- `nginx.ingress.kubernetes.io/session-cookie-name`, `session-cookie-path`, `session-cookie-domain`, `session-cookie-samesite`, `session-cookie-expires`, `session-cookie-max-age`, `session-cookie-secure`: Define cookie attributes for session affinity. **Not projected by the agentgateway emitter.**

---

### SSL Redirect

- `nginx.ingress.kubernetes.io/ssl-redirect`: When set to `"true"`, enables SSL redirect for HTTP requests. For agentgateway, the emitter **splits** the HTTPRoute into an HTTP redirect route (RequestRedirect filter, 301 to HTTPS, no backends) and a separate HTTPS backend route. Note that ingress-nginx redirects with code 308; Gateway API uses 301.

- `nginx.ingress.kubernetes.io/force-ssl-redirect`: When set to `"true"`, enables SSL redirect. Treated identically to `ssl-redirect` by the agentgateway emitter.

**Note:** Both annotations are supported and treated identically. With the agentgateway emitter, SSL redirect is implemented using Gateway API only (no AgentgatewayPolicy).

---

### Regex Path Matching and Rewrites

- `nginx.ingress.kubernetes.io/use-regex`: When set to `"true"`, indicates that the paths defined on that Ingress should be treated as regular expressions.
  Uses host-group semantics: if any Ingress contributing rules for a given host has `use-regex: "true"`, regex-style path matching is enforced on **all**
  paths for that host (across all contributing Ingresses).

- `nginx.ingress.kubernetes.io/rewrite-target`: Rewrites the request path using regex rewrite semantics.
  Uses host-group semantics: if any Ingress contributing rules for a given host sets `rewrite-target`, regex-style path matching is enforced on **all**
  paths for that host (across all contributing Ingresses), consistent with ingress-nginx behavior.

For agentgateway:

- **Regex path matching** is **not currently implemented** for agentgateway output (emitter limitation).
- `rewrite-target` is projected into `AgentgatewayPolicy.spec.traffic.transformation.request.set` (HTTP pseudo-header `:path`), using CEL for literal or regexReplace-style rewrites. The policy is attached via `targetRefs` to the HTTPRoute (full coverage only; partial coverage causes an error).

---

## Provider Limitations

- For this documentation, the **agentgateway emitter** is the supported target; session affinity and regex path matching are not supported by the agentgateway emitter.
- Some NGINX behaviors cannot be reproduced exactly due to differences between NGINX and semantics of other proxy implementations.
- Regex-mode is implemented by converting HTTPRoute path matches to `RegularExpression`. Some ingress-nginx details (such as case-insensitive `~*` behavior)
  may not be reproduced exactly depending on the underlying Gateway API / Envoy behavior and the patterns provided.

If you rely on annotations not listed above, please open an [issue](https://github.com/kgateway-dev/ingress2gateway/issues) or be prepared to apply
post-migration manual adjustments.
