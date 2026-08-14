Secure your applications with JSON Web Token (JWT) authentication by using the agentgateway proxy and an identity provider like Keycloak. To learn more about JWT auth, see [About JWT authentication]({{< link-hextra path="/security/jwt/about/" >}}). 

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

{{< reuse "agw-docs/snippets/keycloak.md" >}}

## Set up JWT authentication

Configure an {{< reuse "agw-docs/snippets/policy.md" >}} to validate JWTs using a remote JWKS endpoint from Keycloak. This approach is recommended for production as it supports automatic key rotation.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} with JWT authentication configuration.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: jwt-auth-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     # Target the Gateway to apply JWT authentication to all routes
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy   
     # Configure JWT authentication
     traffic:
       jwtAuthentication:
         # Validation mode - determines how strictly JWTs are validated
         mode: Strict   
         # List of JWT providers (identity providers)
         providers:
         - # Issuer URL - must match the 'iss' claim in JWT tokens
           issuer: "${KEYCLOAK_ISSUER}"
           # JWKS configuration for remote key fetching
           jwks:
             remote:
               # Path to the JWKS endpoint, relative to the backend root
               jwksPath: "${KEYCLOAK_JWKS_PATH}"
               # Cache duration for JWKS keys (reduces load on identity provider)
               cacheDuration: "5m"
               # Reference to the Keycloak service
               backendRef:
                 group: ""
                 kind: Service
                 name: keycloak
                 namespace: keycloak
                 port: 8080
   EOF
   ```

   | Field | Description | Example |
   |-------|-------------|---------|
   | `mode` | Validation mode for JWT authentication. `Strict` requires a valid JWT for all requests. `Optional` validates JWTs if present but allows requests without tokens. `Permissive` is the least strict mode. | `Strict` |
   | `issuer` | The issuer URL that must match the `iss` claim in JWT tokens exactly. Agentgateway rejects tokens from other issuers.{{< version exclude-if="1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}} Agentgateway also rejects a token that has no `iss` claim.{{< /version >}} | `http://keycloak:8080/realms/master` |
   | `audiences` | List of allowed audience values. The JWT's `aud` claim must contain at least one of these values. Omit the field to accept any audience.{{< version exclude-if="1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}} An empty list also accepts any audience, and a non-empty list rejects a token that has no `aud` claim.{{< /version >}} | `["my-application"]` |
   | `jwks.remote.jwksPath` | The path to the JWKS endpoint on the identity provider, relative to the backend root. This endpoint returns the public keys used to verify JWT signatures. | `/realms/master/protocol/openid-connect/certs` |
   | `jwks.remote.cacheDuration` | How long to cache the JWKS keys locally. This reduces load on the identity provider and improves performance. Keys are automatically refreshed when the cache expires. | `5m` (5 minutes) |
   | `jwks.remote.backendRef` | Reference to the backend that hosts the identity provider. Agentgateway uses this to fetch the JWKS from the identity provider. For an in-cluster provider, reference a Kubernetes Service. For an external provider reached over TLS, reference an {{< reuse "/agw-docs/snippets/backend.md" >}} instead. See [External identity provider over TLS](#external-identity-provider-over-tls). | Keycloak service |


2. View the details of the policy. Verify that the policy is accepted.
   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} jwt-auth-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o json | jq '.status'
   ```

## Verify JWT authentication

Now that JWT authentication is configured, test the setup by obtaining a token from Keycloak and making authenticated requests.

1. Send a request to the httpbin app without any JWT token. Verify that the request fails with a 401 HTTP response code. 
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -v "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/headers -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   HTTP/1.1 401 Unauthorized
   content-type: text/plain
   response-gateway: response path /headers
   content-length: 45
   date: Mon, 19 Jan 2026 16:07:12 GMT

   authentication failure: no bearer token found%  
   ```      
   
2. Create a Keycloak client for the two test users. The client permits only the password grant, which the next step uses to get a token without a browser.

   > [!WARNING]
   > This client exists so that the guide can get a token from the command line for testing purposes only. Real applications do not use the password grant, and they do not need an administrator to create a client for them. To see a client register itself with Keycloak and send the user through a browser login, see the [MCP auth guide]({{< link-hextra path="/mcp/auth/setup/" >}}).

   ```sh {paths="jwt-claims"}
   # Refresh the administrator token, which is short-lived
   KEYCLOAK_TOKEN=$(curl --fail --silent --show-error \
     -d client_id=admin-cli \
     -d username=admin \
     -d password=admin \
     -d grant_type=password \
     "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
     | jq -r .access_token)

   KEYCLOAK_CLIENT=jwt-auth-guide
   KEYCLOAK_SECRET=jwt-auth-guide-secret

   # Create the client, and enable only the password grant
   curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     -H "Content-Type: application/json" \
     -d "{
       \"clientId\": \"${KEYCLOAK_CLIENT}\",
       \"secret\": \"${KEYCLOAK_SECRET}\",
       \"directAccessGrantsEnabled\": true,
       \"standardFlowEnabled\": false,
       \"serviceAccountsEnabled\": false,
       \"publicClient\": false
     }" \
     "$KEYCLOAK_URL/admin/realms/master/clients"
   ```

3. Get an access token for `user1` from Keycloak by using the password grant type.
   ```sh {paths="jwt-claims"}
   ACCESS_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=password" \
     -d "client_id=${KEYCLOAK_CLIENT}" \
     -d "client_secret=${KEYCLOAK_SECRET}" \
     -d "username=user1" \
     -d "password=password" \
     | jq -r '.access_token')
   
   echo $ACCESS_TOKEN
   ```

   {{< doc-test paths="jwt-claims" >}}
   if [ -z "${ACCESS_TOKEN:-}" ] || [ "${ACCESS_TOKEN}" = "null" ]; then
     echo "no access token issued for user1; check the client registration in the previous step"
     exit 1
   fi
   {{< /doc-test >}}

4. Repeat the request to the httpbin app. This time, include the JWT token that you received in the previous step. Verify that the request succeeds and you get back a 200 HTTP response code. 
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -v "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -v "http://localhost:8080/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   ...
   < HTTP/1.1 200 OK
   ...
   {
    "headers": {
      "Accept": [
        "*/*"
      ],
      "Host": [
        "www.example.com"
      ],
      "User-Agent": [
        "curl/8.7.1"
      ]
    }
   }
   ```
  

## Authorize requests by a JWT claim

Authentication proves who sent the request. Authorization decides what that identity is allowed to do. After agentgateway validates the JWT, the claims are available to Common Expression Language (CEL) expressions through the `jwt` variable, so you can write access rules against them in the same {{< reuse "agw-docs/snippets/policy.md" >}}.

The following example allows `user1` and denies every other identity, including `user2`.

1. Update the `jwt-auth-policy` to add an authorization rule.
   ```yaml {paths="jwt-claims"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: jwt-auth-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     traffic:
       jwtAuthentication:
         mode: Strict
         providers:
         - issuer: "${KEYCLOAK_ISSUER}"
           jwks:
             remote:
               jwksPath: "${KEYCLOAK_JWKS_PATH}"
               cacheDuration: "5m"
               backendRef:
                 group: ""
                 kind: Service
                 name: keycloak
                 namespace: keycloak
                 port: 8080
       # Allow only the identity that the JWT belongs to
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - "jwt.preferred_username == 'user1'"
   EOF
   ```

   | Field | Description |
   |-------|-------------|
   | `traffic.authorization.action` | The effect of the rule when it matches. When at least one `Allow` rule is configured, agentgateway denies every request that no allow rule matches. |
   | `traffic.authorization.policy.matchExpressions` | The CEL expressions that must all evaluate to true for the rule to match. This example compares the `preferred_username` claim from the validated token. |

   > [!NOTE]
   > Authorization runs only after authentication succeeds. A request with a missing or invalid token fails JWT authentication and returns a `401` before any expression is evaluated. Authorization denials return a `403`.

   {{< doc-test paths="jwt-claims" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for jwt-auth-policy with authorization to be accepted
     wait:
       target:
         kind: AgentgatewayPolicy
         metadata:
           namespace: agentgateway-system
           name: jwt-auth-policy
       jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 60
         intervalSeconds: 2
   EOF
   {{< /doc-test >}}

2. Repeat the request with `user1`'s token. Verify that the request still succeeds, because the `preferred_username` claim matches the allow rule.
   ```sh
   curl -v "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}"
   ```

3. Get a token for `user2`, and send the same request. Verify that the request fails with a `403 Forbidden` response code. The token is valid, so authentication succeeds, but no allow rule matches the `user2` identity.
   ```sh {paths="jwt-claims"}
   USER2_TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=password" \
     -d "client_id=${KEYCLOAK_CLIENT}" \
     -d "client_secret=${KEYCLOAK_SECRET}" \
     -d "username=user2" \
     -d "password=password" \
     | jq -r '.access_token')

   curl -v "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "Authorization: Bearer ${USER2_TOKEN}"
   ```

   Example output:
   ```
   ...
   < HTTP/1.1 403 Forbidden
   ...
   ```

{{< doc-test paths="jwt-claims" >}}
# The visible blocks set both tokens as shell variables; export them so that
# YAMLTest (a child process that interpolates them from its environment) can read them.
export ACCESS_TOKEN
export USER2_TOKEN
YAMLTest -f - <<'EOF'
- name: user1 matches the allow rule
  retries: 3
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/headers"
    method: GET
    headers:
      host: "www.example.com"
      authorization: "Bearer ${ACCESS_TOKEN}"
  source:
    type: local
  expect:
    statusCode: 200
- name: user2 is authenticated but not authorized
  retries: 3
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/headers"
    method: GET
    headers:
      host: "www.example.com"
      authorization: "Bearer ${USER2_TOKEN}"
  source:
    type: local
  expect:
    statusCode: 403
EOF
{{< /doc-test >}}

For more authorization rules, such as combining `Allow` with `Require` or restricting access by source address, see [Authorization]({{< link-hextra path="/security/authorization/" >}}). For the claims and functions that you can use in an expression, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

## Other JWT auth examples

Review other common JWT auth configuration examples that you can add to your {{< reuse "agw-docs/snippets/policy.md" >}}.

### Multiple JWT providers

You can configure multiple JWT providers to accept tokens from different identity providers. The following example uses Keycloak and the Auth0 identity providers. 

```yaml

traffic:
  jwtAuthentication:
    mode: Strict
    providers:
    - issuer: "${KEYCLOAK_ISSUER}"
      audiences: ["my-application"]
      jwks:
        remote:
          jwksPath: "${KEYCLOAK_JWKS_PATH}"
          backendRef:
            name: keycloak
            namespace: keycloak
            kind: Service
            port: 8080
    - issuer: "https://auth0.example.com/"
      audiences: ["my-other-application"]
      jwks:
        remote:
          jwksPath: "/.well-known/jwks.json"
          backendRef:
            name: auth0-proxy
            namespace: auth-system
            kind: Service
            port: 443
```

### External identity provider over TLS

When your identity provider runs outside the cluster (for example, Okta, Auth0, or Microsoft Entra ID) and is served over HTTPS, reference an {{< reuse "/agw-docs/snippets/backend.md" >}} in the `jwks.remote.backendRef` instead of a Kubernetes Service. The {{< reuse "/agw-docs/snippets/backend.md" >}} sets the upstream host and TLS SNI together, so the JWKS fetch connects to the provider with the correct hostname and certificate.

1. Create an {{< reuse "/agw-docs/snippets/backend.md" >}} for the identity provider. Set `static.host` to the provider's public hostname and `policies.tls.sni` to the same hostname. Because no `caCertificateRefs` are set, the provider's certificate is verified against the system trust store.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "/agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
   metadata:
     name: okta-jwks
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: myorg.okta.com
       port: 443
     policies:
       tls:
         sni: myorg.okta.com
   EOF
   ```
   {{< version include-if="main" >}}
   If your identity provider presents a certificate that is signed by a private CA, add `policies.tls.caCertificateRefs` to the {{< reuse "/agw-docs/snippets/backend.md" >}}. The certificate must be in a `ca.crt` key of a ConfigMap or a Secret in the same namespace as the {{< reuse "/agw-docs/snippets/backend.md" >}}. Omit `kind` to read the certificate from a ConfigMap, or set `kind: Secret` to read it from a Secret, such as a Secret that cert-manager issues.

   ```yaml
       policies:
         tls:
           sni: myorg.okta.com
           caCertificateRefs:
           - name: idp-ca
             kind: Secret
   ```
   {{< /version >}}

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that points `jwks.remote.backendRef` at the {{< reuse "/agw-docs/snippets/backend.md" >}} that you created.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: jwt-auth-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     # Target the Gateway to apply JWT authentication to all routes
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     # Configure JWT authentication
     traffic:
       jwtAuthentication:
         mode: Strict
         providers:
         - issuer: "https://myorg.okta.com/oauth2/default"
           audiences: ["my-application"]
           jwks:
             remote:
               jwksPath: "/oauth2/default/v1/keys"
               cacheDuration: "5m"
               backendRef:
                 group: {{< reuse "/agw-docs/snippets/group.md" >}}
                 kind: {{< reuse "/agw-docs/snippets/backend.md" >}}
                 name: okta-jwks
                 port: 443
   EOF
   ```

   > [!NOTE]
   > If the {{< reuse "/agw-docs/snippets/backend.md" >}} is in a different namespace than the {{< reuse "agw-docs/snippets/policy.md" >}}, add the `namespace` field to the `backendRef` and create a `ReferenceGrant` that permits the cross-namespace reference.

### Inline JWKS

For testing purposes, you can use inline JWKS instead of a remote JWKS endpoint. Note that this setup is not recommended for production as it requires manual key updates.

```yaml

traffic:
  jwtAuthentication:
    mode: Strict
    providers:
    - issuer: "${KEYCLOAK_ISSUER}"
      audiences: ["my-application"]
      jwks:
        inline: '{"keys":[{"kty":"RSA","kid":"key-id-123","use":"sig","n":"0vx7agoebG...","e":"AQAB"}]}'
```

### Allow missing

By default, the JWT validation mode is set to `Strict` and allows connections to a backend destination only if a valid JWT was provided as part of the request. 

To allow requests, even if no JWT was provided or if the JWT cannot be validated, use the `Permissive` or `Optional` modes. 

**Optional**

The JWT is optional. If a JWT is provided during the request, the agentgateway proxy validates it. In the case that the JWT validation fails, the request is denied. However, keep in mind that if no JWT is provided during the request, the request is explicitly allowed. 

```yaml

traffic:
  jwtAuthentication:
    mode: Optional
    providers:
    - issuer: "${KEYCLOAK_ISSUER}"
      audiences: ["my-application"]
      jwks:
        remote:
          jwksPath: "${KEYCLOAK_JWKS_PATH}"
          backendRef:
            name: keycloak
            namespace: keycloak
            kind: Service
            port: 8080
```

**Permissive**

Requests are never rejected, even if no or invalid JWTs are provided during the request.

```yaml

traffic:
  jwtAuthentication:
    mode: Permissive
    providers:
    - issuer: "${KEYCLOAK_ISSUER}"
      audiences: ["my-application"]
      jwks:
        remote:
          jwksPath: "${KEYCLOAK_JWKS_PATH}"
          backendRef:
            name: keycloak
            namespace: keycloak
            kind: Service
            port: 8080
```

### PreRouting phase

By default, JWT authentication is enforced during routing. Use the `PreRouting` phase to validate JWTs before any routing decision is made. This is useful when you want to enforce authentication for all traffic at the gateway level, regardless of the route.

```yaml

traffic:
  phase: PreRouting
  jwtAuthentication:
    mode: Strict
    providers:
    - issuer: "${KEYCLOAK_ISSUER}"
      audiences: ["my-application"]
      jwks:
        remote:
          jwksPath: "${KEYCLOAK_JWKS_PATH}"
          cacheDuration: "5m"
          backendRef:
            name: keycloak
            namespace: keycloak
            kind: Service
            port: 8080
```



## Use JWT claims in transformations {#jwt-claims-transformations}

After a JWT is validated, its claims are available to [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) through the `jwt` context variable. You can use these claims in [transformations]({{< link-hextra path="/traffic-management/transformations/" >}}) to forward the authenticated user's identity to your backends, or to route requests based on a claim. See [Claim-based routing](#claim-based-routing).

The `jwt` variable is populated only after the JWT is validated. Keep `jwtAuthentication` and the `transformation` on the same {{< reuse "agw-docs/snippets/policy.md" >}} and phase so that both apply to the same requests. JWT authentication always runs before transformations in the request pipeline, so the claims are available when the transformation evaluates them.

### Available JWT claims {#available-jwt-claims}

Access standard and custom claims from the `jwt` variable. Registered claims, such as `sub`, use dot notation. Custom claims whose names contain special characters, such as a URL, require bracket notation.

| CEL expression | Description |
|----------------|-------------|
| `jwt.sub` | The subject (`sub`) claim, which is usually the user ID. |
| `jwt.iss` | The issuer (`iss`) claim. |
| `jwt.aud` | The audience (`aud`) claim. |
| `jwt.exp` | The expiration (`exp`) time, as a Unix timestamp. |
| `jwt['custom-claim']` | Any custom claim. Use bracket notation for claim names that contain special characters, such as `jwt['https://example.com/tier']`. |
| `jwt.rawToken` | The raw bearer token. Redacted by default. Use `jwt.rawToken.unredacted()` to access the value. |

Because the `value` field of a transformation is a CEL expression, `jwt.sub` refers to the claim value, not the literal string `jwt.sub`. To set a header to a fixed string instead, wrap the value in inner single quotes, such as `value: "'my-value'"`. A claim might also be absent from a token, so wrap claim access in `default()` to provide a fallback and avoid errors, such as `default(jwt.role, 'user')`. For the full list of context variables and functions, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

### Forward JWT claims to a backend

In this example, you add a transformation to the JWT policy that copies claims from the validated token into request headers before the request is forwarded to the backend. This is a common way to pass the authenticated user's identity to upstream apps without having them parse the JWT.

1. Update the `jwt-auth-policy` to add a `transformation` that sets request headers from JWT claims. The `x-user-role` header uses `default()` to fall back to `user` when the `role` claim is absent.
   ```yaml {paths="jwt-claims"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: jwt-auth-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     traffic:
       jwtAuthentication:
         mode: Strict
         providers:
         - issuer: "${KEYCLOAK_ISSUER}"
           jwks:
             remote:
               jwksPath: "${KEYCLOAK_JWKS_PATH}"
               cacheDuration: "5m"
               backendRef:
                 group: ""
                 kind: Service
                 name: keycloak
                 namespace: keycloak
                 port: 8080
       # Copy JWT claims into request headers for the backend
       transformation:
         request:
           set:
           - name: x-user-id
             value: "jwt.sub"
           - name: x-auth-issuer
             value: "jwt.iss"
           - name: x-user-role
             value: "default(jwt.role, 'user')"
   EOF
   ```

   {{< doc-test paths="jwt-claims" >}}
   # WHAT THIS TEST VALIDATES:
   #   * The transformation reads validated JWT claims — x-auth-issuer is set from
   #     jwt.iss, proving the jwt CEL variable is populated before the transformation runs.
   #   * default() falls back correctly — x-user-role is 'user' because the token has no
   #     top-level 'role' claim, exercising default(jwt.role, 'user').
   # WHAT THIS TEST DOES NOT VALIDATE (and why):
   #   * The exact jwt.sub value (x-user-id) — Different layer: the value is a dynamic
   #     Keycloak user UUID, so only issuer/role (deterministic) are asserted.
   #   * The full claim-based routing split (premium vs free backend) — Requires
   #     config/traffic the page omits: real premium-backend / free-backend Services and a
   #     token carrying a 'tier' claim (the default token has none). The Claim-based routing
   #     section instead tests the piece that IS deterministic: a later jwt-claims assertion
   #     confirms the PreRouting transformation derives x-user-tier='free' from default().
   #
   # The visible token block sets ACCESS_TOKEN as a shell variable; export it so that
   # YAMLTest (a child process that interpolates ${ACCESS_TOKEN} from its environment)
   # can read it.
   export ACCESS_TOKEN
   {{< /doc-test >}}

   {{< doc-test paths="jwt-claims" >}}
   YAMLTest -f - <<'EOF'
   - name: validated JWT claims are injected as request headers
     retries: 3
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/headers"
       method: GET
       headers:
         host: www.example.com
         authorization: "Bearer ${ACCESS_TOKEN}"
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.headers.X-Auth-Issuer[0]"
           comparator: contains
           value: "realms/master"
         - path: "$.headers.X-User-Role[0]"
           comparator: contains
           value: "user"
   EOF
   {{< /doc-test >}}

2. Using the `ACCESS_TOKEN` that you retrieved in [Verify JWT authentication](#verify-jwt-authentication), send an authenticated request to the httpbin app. Because httpbin echoes back the headers that it receives, you can verify that the claims were injected.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.headers'
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -s "http://localhost:8080/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.headers'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   In the response, verify that the `X-User-Id`, `X-Auth-Issuer`, and `X-User-Role` headers contain the values from your JWT claims.
   ```json
   {
     "Accept": ["*/*"],
     "Host": ["www.example.com"],
     "User-Agent": ["curl/8.7.1"],
     "X-Auth-Issuer": ["http://keycloak:8080/realms/master"],
     "X-User-Id": ["a1b2c3d4-..."],
     "X-User-Role": ["user"]
   }
   ```

### Claim-based routing {#claim-based-routing}

You can route requests to different backends based on a JWT claim, such as sending premium and free-tier users to different services. To do this, use a `PreRouting` transformation to copy a claim into a request header, then match on that header in your `HTTPRoute` rules. The `PreRouting` phase runs the transformation before the gateway makes a routing decision, so the header is available for matching. See [PreRouting phase](#prerouting-phase).

> [!IMPORTANT]
> This example is illustrative. The following steps show how to derive a routing header from a claim and confirm it is set, but verifying the full premium/free split requires two things that you must configure:
> - **Running `premium-backend` and `free-backend` Services.** Replace them with your own backends, then compare which one handles the request.
> - **A token that carries the `tier` claim.** The default Keycloak master-realm token has no `tier` claim, so every request falls back to `free`. To exercise the premium path, configure a Keycloak client scope or protocol mapper that adds a `tier` claim, then request a token that includes `tier: premium`.

1. Create or update the `jwt-auth-policy` to validate the JWT and, in the `PreRouting` phase, copy a `tier` claim into an `x-user-tier` header. Reusing the same policy name replaces the policy from the previous section, so that only one JWT policy targets the Gateway.
   ```yaml {paths="jwt-claims"}
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: jwt-auth-policy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     traffic:
       phase: PreRouting
       jwtAuthentication:
         mode: Strict
         providers:
         - issuer: "${KEYCLOAK_ISSUER}"
           jwks:
             remote:
               jwksPath: "${KEYCLOAK_JWKS_PATH}"
               cacheDuration: "5m"
               backendRef:
                 group: ""
                 kind: Service
                 name: keycloak
                 namespace: keycloak
                 port: 8080
       transformation:
         request:
           set:
           - name: x-user-tier
             value: "default(jwt.tier, 'free')"
   EOF
   ```

2. Before you add routing rules, confirm that the `PreRouting` transformation derives the `x-user-tier` header from the JWT claim. Send an authenticated request to the httpbin app, which echoes back the headers that it receives. Because the default Keycloak token has no `tier` claim, `default(jwt.tier, 'free')` evaluates to `free`. For local testing with port-forwarding, use `http://localhost:8080/headers` instead.
   ```sh
   curl -s "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.headers'
   ```

   {{< doc-test paths="jwt-claims" >}}
   YAMLTest -f - <<'EOF'
   - name: PreRouting transformation derives the routing header from the JWT claim
     retries: 3
     http:
       url: "http://${INGRESS_GW_ADDRESS}:80/headers"
       method: GET
       headers:
         host: www.example.com
         authorization: "Bearer ${ACCESS_TOKEN}"
     source:
       type: local
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.headers.X-User-Tier[0]"
           comparator: contains
           value: "free"
   EOF
   {{< /doc-test >}}

   In the response, verify that the `X-User-Tier` header is set to `free`.
   ```json
   {
     "Accept": ["*/*"],
     "Host": ["www.example.com"],
     "User-Agent": ["curl/8.7.1"],
     "X-User-Tier": ["free"]
   }
   ```

3. Create an `HTTPRoute` that routes requests to different backends based on the `x-user-tier` header. Requests with `x-user-tier: premium` go to the premium backend, and all other requests fall through to the default backend.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: tier-routing
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
     hostnames:
     - www.example.com
     rules:
     # Premium users, matched on the header set from the JWT claim
     - matches:
       - headers:
         - name: x-user-tier
           value: premium
       backendRefs:
       - name: premium-backend
         port: 8080
     # All other users
     - backendRefs:
       - name: free-backend
         port: 8080
   EOF
   ```



## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} jwt-auth-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete httproute tier-routing -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete ns keycloak
```
