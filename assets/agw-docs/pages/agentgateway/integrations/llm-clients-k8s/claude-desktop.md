Configure [Claude Desktop](https://claude.com/download) to route requests through your agentgateway proxy running in Kubernetes.

## About third-party inference mode {#about}

{{< reuse "agw-docs/snippets/claude-desktop-3p.md" >}}

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Install [Claude Desktop](https://claude.com/download).
3. Choose how the proxy authenticates callers.

   | Method | When to use | Upstream billing |
   | -- | -- | -- |
   | **[Gateway API key](#gateway-api-key)** | Recommended starting point. Agentgateway validates a client key and adds a separately managed Anthropic API key upstream. | Anthropic API account |
   | **[Identity provider](#sso)** | Recommended for an enterprise rollout. Agentgateway validates each user's OIDC token and adds a separately managed Anthropic API key upstream. | Anthropic API account |
   | **[Claude subscription passthrough](#configure-claude-desktop)** | Advanced option for preserving per-user Claude subscription usage. Agentgateway passes each user's token upstream and does not independently authenticate the caller. | User's Claude subscription |

   For a gateway API key, you need an Anthropic API key for the proxy and a
   [virtual API key]({{< link-hextra
   path="/llm/cost-controls/virtual-keys/" >}}) for Claude Desktop. For
   subscription passthrough, you need a Claude Pro, Max, Team, or Enterprise
   subscription and the [Claude Code CLI](https://code.claude.com/docs), which
   provides the `claude setup-token` command. For identity-provider
   authentication, you need an OIDC provider and an Anthropic API key for the
   proxy.

## Get the gateway URL {#gateway-url}

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

> [!IMPORTANT]
> **Claude Desktop accepts a plain HTTP gateway URL only on a loopback address.** Any other host must use HTTPS. A plain HTTP URL that points to a LoadBalancer address or a hostname fails validation when you test the connection, with the error `Invalid custom3p enterprise config: baseUrl: must use https (or http on loopback)`.
>
> You therefore have two options:
>
> * **Port-forward the proxy** and use `http://127.0.0.1:<port>`. Use the literal address `127.0.0.1`, because `localhost` does not always resolve as a loopback address for this check. Choose this option to try out the setup on a single machine.
> * **Terminate HTTPS on the proxy** and use `https://<hostname>`. Choose this option when you [roll out the configuration to your organization](#mdm), because each user's machine must reach the proxy over the network. To set up a certificate, see [HTTPS listeners]({{< link-hextra path="/setup/listeners/https/" >}}).

> [!NOTE]
> The Kubernetes Admin UI is read-only and does not currently show the standalone **LLM > Client Setup** generator. Configure the client with the same gateway URL and credential values manually. The client settings are not specific to a deployment mode; only the resources that configure agentgateway differ. Follow [agentgateway/agentgateway#2989](https://github.com/agentgateway/agentgateway/issues/2989) for the enhancement, and see [Admin UI]({{< link-hextra path="/observability/ui/" >}}) for more information about the current UI.

## Set up the Anthropic backend

1. Create a Kubernetes Secret for the Anthropic API key that agentgateway sends
   upstream. This provider credential is separate from the gateway key that
   Claude Desktop sends to agentgateway.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: anthropic-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     Authorization: "$ANTHROPIC_API_KEY"
   EOF
   ```

2. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the Anthropic
   provider and reference the provider credential.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: anthropic-desktop
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         anthropic: {}
     policies:
       auth:
         secretRef:
           name: anthropic-secret
       ai:
         routes:
           '/v1/messages': Messages
           '/v1/messages/count_tokens': AnthropicTokenCount
           '*': Passthrough
   EOF
   ```

   The `Authorization` value from `anthropic-secret` is sent upstream as the
   Anthropic `x-api-key`. Do not distribute this provider credential to Claude
   Desktop users.

3. Create an `{{< reuse "agw-docs/snippets/policy.md" >}}` to raise the body
   buffer limit to 10 MB for Claude Desktop and Cowork requests.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: claude-desktop-buffer
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: claude-desktop
     frontend:
       http:
         maxBufferSize: 10485760
   EOF
   ```

   > [!NOTE]
   > Claude Code automatically sends the `anthropic-beta: oauth-2025-04-20` header required for OAuth-based authentication. Claude Desktop might require this header to be set as well depending on your client version. If requests fail with a 400 error, add a request transformation to the {{< reuse "agw-docs/snippets/policy.md" >}} that injects the header.
   >
   > ```yaml
   > backend:
   >   transformation:
   >     request:
   >       set:
   >       - name: anthropic-beta
   >         value: oauth-2025-04-20
   > ```

4. Create an `HTTPRoute` that matches the `/claude` path prefix and rewrites it to `/` before forwarding to the backend. Because the policy in the previous step targets this route, create both resources before you check the policy status.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: claude-desktop
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
         - path:
             type: PathPrefix
             value: /claude
         backendRefs:
         - name: anthropic-desktop
           namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         filters:
         - type: URLRewrite
           urlRewrite:
             path:
               type: ReplacePrefixMatch
               replacePrefixMatch: /
   EOF
   ```

## Use a gateway API key {#gateway-api-key}

You can use the same client-side values that the standalone **Client Setup** page produces. The Kubernetes Admin UI does not generate these values, so configure the gateway and Claude Desktop manually.

1. Verify that the `anthropic-desktop` backend references `anthropic-secret` in
   `policies.auth`, as configured in [Set up the Anthropic
   backend](#set-up-the-anthropic-backend). For more information, see
   [Anthropic provider]({{< link-hextra path="/llm/providers/anthropic/" >}}).
2. Generate a client API key and store it in a Kubernetes Secret. Use a
   separate entry for each user or device when you need independent attribution
   or revocation.

   ```bash
   export CLAUDE_GATEWAY_API_KEY="agw_$(openssl rand -hex 24)"

   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: claude-desktop-client-keys
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   type: Opaque
   stringData:
     claude-desktop: "$CLAUDE_GATEWAY_API_KEY"
   EOF
   ```

   For key metadata, hashing, and cost controls, see [Virtual
   keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).

3. Apply strict API key authentication to only the Claude Desktop
   `HTTPRoute`.

   ```bash
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: claude-desktop-api-key
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: claude-desktop
     traffic:
       apiKeyAuthentication:
         mode: Strict
         secretRef:
           name: claude-desktop-client-keys
   EOF
   ```

   Target the `agentgateway-proxy` `Gateway` only when every attached route
   expects an agentgateway key.
4. In Claude Desktop, go to **Developer → Configure Third Party Inference → Gateway**.
5. For **Gateway base URL**, enter the URL from [Get the gateway URL](#gateway-url). Include `/claude` for the shared-hostname route in this guide, but use only the origin when a dedicated hostname matches `/`.
6. For **Credential kind**, select **Static API key**. Enter
   `$CLAUDE_GATEWAY_API_KEY` in **Gateway API key**, and select **Bearer** for
   the auth scheme.
7. Under **Models**, add the full model ID that the backend exposes, or verify
   that the gateway returns it from `GET /v1/models`.
8. Click **Test connection**, and then click **Apply Changes**. Fully quit
   Claude Desktop and reopen it.
9. Send a harmless prompt and confirm that the agentgateway request log records
   `/v1/messages` with HTTP 200. Then send a request without the gateway key and
   confirm that the route returns HTTP 401. The negative test verifies that the
   route does not admit unauthenticated callers.

Claude Desktop sends Anthropic Messages API requests to `/v1/messages`. Agentgateway can translate those requests for another provider, but a route that exposes only the OpenAI-compatible `/v1/chat/completions` API is not sufficient.

For a managed rollout, see [Manage gateway API keys with Microsoft
Intune]({{< link-hextra
path="/integrations/llm-clients/microsoft-intune/#claude-gateway-api-key" >}}).

## Optional: Use Claude subscription passthrough {#configure-claude-desktop}

Subscription passthrough preserves per-user Claude subscription billing, but
agentgateway does not independently authenticate the caller. Remove the
provider credential from the backend so that the user's bearer token can pass
through to Anthropic.

```bash
kubectl patch {{< reuse "agw-docs/snippets/backend.md" >}} anthropic-desktop \
  -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --type=json \
  -p='[{"op":"remove","path":"/spec/policies/auth"}]'
```

Do not apply a strict virtual API key policy to this route. If you are
converting an existing gateway-key configuration, remove its route-level API
key policy first. Never remove a Gateway-level policy unless you have verified
that no other attached route depends on it.

1. Get a bearer token for your Claude account. Store the value in a safe place.

   ```bash
   claude setup-token
   ```

2. Open Claude Desktop and enable developer mode from the menu bar: **Help → Troubleshooting → Enable Developer Mode**. Then fully quit and relaunch Claude Desktop. A new **Developer** menu appears in the menu bar.

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the **Gateway base URL**. Remember that a host other than a loopback address must use HTTPS, as described in [Get the gateway URL](#gateway-url).

   {{< tabs >}}

   {{% tab name="Shared hostname" %}}
   When the `HTTPRoute` matches `/claude` and rewrites the prefix as shown in
   this guide, include `/claude` in the base URL.

   ```
   https://$INGRESS_GW_HOSTNAME/claude
   ```
   {{% /tab %}}

   {{% tab name="Dedicated hostname" %}}
   When an `HTTPRoute` for a dedicated hostname such as
   `claude.example.com` matches `/` without a prefix rewrite, use only the
   origin. Claude Desktop appends `/v1/models` and `/v1/messages`.

   ```
   https://claude.example.com
   ```
   {{% /tab %}}

   {{% tab name="Port-forward for local testing" %}}
   Use the literal address `127.0.0.1` rather than `localhost`.

   ```bash
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 4001:80 &
   ```

   For the gateway address in Claude Desktop, enter:

   ```
   http://127.0.0.1:4001/claude
   ```
   {{% /tab %}}

   {{< /tabs >}}

5. For **Credential kind**, select **Static API key**. For **Gateway auth
   scheme**, select **Bearer**, and enter the token from step 1 in **Gateway
   API key**. Each user must use their own subscription token. To authenticate
   users with your identity provider and use a centrally managed provider
   credential instead, see [Authenticate users with your identity
   provider](#sso).

6. Open **Models** and add at least one full model ID that the subscription can
   use, such as `claude-opus-5`. Do not use an alias such as `opus`. The
   first entry is the default. Turn off **Model discovery**, or leave it unset;
   an explicit model list makes discovery unnecessary.

7. Click **Test connection**. Claude Desktop tests inference with the first
   configured model. If no explicit model is configured, the test first calls
   `<base-url>/v1/models` and fails when the gateway or provider does not make
   that endpoint available to the subscription token.

   > [!NOTE]
   > With subscription passthrough, the connection test might return HTTP 429
   > with `rate_limit_error` even when normal Cowork inference works. Apply the
   > configuration, send a harmless prompt, and check the agentgateway request
   > log. If the actual `/v1/messages` request returns HTTP 200, treat the
   > connection-test result as a false negative.

8. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. Claude Desktop reads its configuration only at launch.

   > [!NOTE]
   > On macOS, Claude Desktop might not enter third-party inference mode from the settings panel alone. If the app still signs in to Anthropic after you reopen it, set `deploymentMode` to `3p` in the third-party configuration file, then quit and reopen the app again.
   >
   > ```bash
   > python3 - <<'EOF'
   > import json, os
   > p = os.path.expanduser('~/Library/Application Support/Claude-3p/claude_desktop_config.json')
   > d = json.load(open(p))
   > d['deploymentMode'] = '3p'
   > open(p, 'w').write(json.dumps(d, indent=2))
   > EOF
   > ```

For a managed rollout of this subscription configuration, see [Manage Claude
subscriptions with Microsoft Intune]({{< link-hextra
path="/integrations/llm-clients/microsoft-intune/#claude-subscription" >}}).

## Authenticate users with your identity provider {#sso}

{{< reuse "agw-docs/snippets/claude-desktop-sso-overview.md" >}}

The following steps use Microsoft Entra ID as the example identity provider. Any OpenID Connect (OIDC) provider works the same way. Substitute your own issuer URL, client ID, and JWKS path.

1. Register a public-client application with your identity provider, and
   record the client ID and issuer URL. Do not create a client secret. The
   following values configure Claude Desktop's browser flow.

   | Setting | Value |
   | -- | -- |
   | Client type | Public client. Claude Desktop holds no client secret. |
   | Redirect URI | `http://127.0.0.1/callback` |
   | Scopes | `openid profile email offline_access` |

   > [!IMPORTANT]
   > Two details about the redirect URI cause most failures:
   >
   > * Include the `/callback` path. Claude Desktop redirects to `http://127.0.0.1:<port>/callback`, and a registration of `http://127.0.0.1` alone does not match. On Entra ID, the mismatch returns `AADSTS50011`.
   > * Register the URI as a native or desktop client, not a web client. Claude Desktop picks an ephemeral port for each sign-in. A native client registration accepts any loopback port, as described in [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3), and a web client registration requires an exact port match. On Entra ID, select the **Mobile and desktop applications** platform. The browser and broker authorization-code flows do not require the legacy **Allow public client flows** toggle; leave it disabled.
   > * Do not register the agentgateway hostname as the redirect URI. Claude
   >   Desktop receives the authorization response, then sends the resulting
   >   token to the gateway URL on inference requests.

2. Save the identifiers from your registration, so that the following commands can refer to them.

   ```bash
   export TENANT_ID=<your-tenant-id>
   export CLIENT_ID=<your-client-id>
   ```

3. Create an `AgentgatewayBackend` for the JWKS endpoint of your identity provider. The proxy fetches the signing keys from this backend to verify tokens.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayBackend
   metadata:
     name: oidc-jwks
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: login.microsoftonline.com
       port: 443
     policies:
       tls: {}
   EOF
   ```

4. Create an `{{< reuse "agw-docs/snippets/policy.md" >}}` that requires a valid token on the Claude Desktop route.

   If this route currently has a strict API key policy, remove that policy as
   part of the transition. Do not attach both authentication policies to the
   Claude Desktop route. Keep policies for other clients scoped to their own
   routes.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: claude-desktop-jwt
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: claude-desktop
     traffic:
       jwtAuthentication:
         mode: Strict
         providers:
         - issuer: https://login.microsoftonline.com/$TENANT_ID/v2.0
           audiences:
           - $CLIENT_ID
           jwks:
             remote:
               backendRef:
                 group: agentgateway.dev
                 kind: AgentgatewayBackend
                 name: oidc-jwks
                 namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
                 port: 443
               jwksPath: /$TENANT_ID/discovery/v2.0/keys
               cacheDuration: 5m
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `mode` | Set to `Strict` so that the proxy rejects any request that has no valid token. The default value, `Optional`, admits requests that carry no token at all. |
   | `issuer` | The expected `iss` claim. Validating the issuer alongside the signature is what ties a token to your tenant. |
   | `audiences` | The expected `aud` claim. For an ID token, the audience is the client ID of the application that you registered. |
   | `jwks.remote.backendRef` | The backend that hosts the JWKS endpoint, from the previous step. |
   | `jwks.remote.jwksPath` | The path to the JWKS document on that host. |

   Use the issuer base URL shown in the example. Do not use the OpenID
   discovery-document URL, which ends in `/.well-known/openid-configuration`,
   as the issuer.

   For more detail on JWT validation, see [JWT auth]({{< link-hextra path="/security/jwt/setup/" >}}).

5. Give the backend its own credential. Interactive sign-in puts the identity provider token in the `Authorization` header, so the proxy must supply the LLM provider credential itself rather than pass a user token upstream. Follow [Anthropic provider]({{< link-hextra path="/llm/providers/anthropic/" >}}) to create a secret and reference it from `policies.auth` on the {{< reuse "agw-docs/snippets/backend.md" >}} resource.

6. In Claude Desktop, go to **Developer → Configure Third Party Inference → Gateway** and set the following fields.

   | Field | Value |
   | -- | -- |
   | Credential kind | **Interactive sign-in** |
   | Gateway base URL | Your gateway URL, as described in [Get the gateway URL](#gateway-url) |
   | Client ID | The client ID of the application that you registered |
   | Issuer URL | `https://login.microsoftonline.com/$TENANT_ID/v2.0` |
   | Bearer token | **ID token** |
   | Scopes | `openid profile email offline_access` |
   | Sign-in flow | **Browser** for this initial test; use the [Intune guide]({{< link-hextra path="/integrations/llm-clients/microsoft-intune/#claude-entra" >}}) to move managed devices to **Broker** |
   | Model discovery | **Off** when you use a fixed model list |
   | Models | One or more full model IDs that the backend exposes |

   {{< reuse "agw-docs/snippets/claude-desktop-id-token-warning.md" >}}

7. From Claude Desktop, click **Test connection**. Then click **Apply Changes**,
   fully quit Claude Desktop, and reopen it. A browser window opens to your
   identity provider. After you sign in, send a real prompt to verify that the
   saved configuration still works after restart.

8. Confirm that the proxy sees the authenticated identity.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

   Confirm that the real `POST /v1/messages` request returns HTTP 200 and
   includes `jwt.sub` for the signed-in user. This confirms that Claude
   Desktop sent the Entra ID token and that agentgateway validated it before
   forwarding the request.

## Send custom headers {#headers}

Use the **Custom inference headers** field to add a header to every inference request, such as a tenant identifier that a route or a policy matches on. Claude Desktop sends these headers on requests from Chat, Cowork, and Code alike.

To supply a header value that changes over time, set a credential helper instead. A credential helper is an executable that Claude Desktop runs with no arguments and that prints either a bare token or a JSON object in the form `{"token": "...", "headers": {"Name": "Value"}}`. Claude Desktop caches the result and re-runs the helper when the cache expires, with no prompt and no relaunch. Helper headers override custom inference headers of the same name, and a configured helper replaces any static API key. Use a helper to read a short-lived credential from a secret store.

## Roll out to your organization {#mdm}

Configure and test one machine in developer mode first. When the connection works, click **Export** in the **Configure Third Party Inference** panel to produce a profile for your device management system, and distribute it with the tool that you already use, such as Jamf, Intune, Workspace ONE, or Group Policy. Users then receive the configuration on first launch and do not configure anything by hand.

For an end-to-end Microsoft Intune rollout with Entra ID and managed-device
enforcement, see [Manage Claude Desktop with Microsoft Intune]({{< link-hextra
path="/integrations/llm-clients/microsoft-intune/#claude-entra" >}}).

Managed configuration takes precedence over local settings, so a user cannot point the app at a different endpoint. The delivery mechanism differs per operating system.

| Operating system | Managed configuration |
| -- | -- |
| macOS | A configuration profile that writes `/Library/Managed Preferences/<user>/com.anthropic.claudefordesktop.plist` |
| Windows | Registry values under `HKLM\SOFTWARE\Policies\Claude`, which override any values under `HKCU` |
| Linux | A root-owned `/etc/claude-desktop/managed-settings.json` file that is not writable by group or other |

The following example shows the Linux form. On macOS and Windows, write every value as a string, including numbers, booleans, and nested JSON.

```json
{
  "inferenceProvider": "gateway",
  "inferenceGatewayBaseUrl": "https://agentgateway.example.com/claude",
  "inferenceCredentialKind": "interactive",
  "inferenceGatewayOidcAuthFlow": "browser",
  "inferenceGatewayOidc": {
    "issuer": "https://login.microsoftonline.com/$TENANT_ID/v2.0",
    "clientId": "$CLIENT_ID",
    "scopes": "openid profile email offline_access",
    "bearerTokenType": "id_token"
  },
  "modelDiscoveryEnabled": false,
  "inferenceModels": ["claude-opus-5"],
  "inferenceCustomHeaders": {
    "X-Tenant-Id": "acme"
  }
}
```

For every available key and for the per-region profiles that a multi-region deployment needs, see the [Claude Desktop configuration reference](https://claude.com/docs/third-party/claude-desktop/configuration).

## Verify the connection

1. Send a message in Claude Desktop, such as `test`.

2. Check the proxy logs to confirm traffic is flowing through agentgateway.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

3. If you configured gateway API key or OIDC authentication in strict mode, send a request without the `Authorization` header and confirm that agentgateway rejects it. This negative check verifies that the route does not admit unauthenticated requests.

## Troubleshoot the connection

| Symptom | Likely cause and action |
| -- | -- |
| The connection test calls `/claude/v1/models` on a dedicated Claude hostname | Remove `/claude` from the base URL, or update the `HTTPRoute` to match and rewrite that prefix. |
| The gateway API key connection returns HTTP 401 | Confirm that Claude Desktop sends the client key stored in the policy's Secret and that the strict API key policy is attached to the Claude Desktop `HTTPRoute`. |
| Entra sign-in returns `api key authentication failure` | The Claude Desktop route is still protected by its old virtual API key policy. Replace that policy with the JWT policy; do not require both. |
| Entra Test connection succeeds, but restart logs `InvalidToken` | An older managed profile restored a static key. Update the assigned profile to `interactive`, remove `inferenceGatewayApiKey`, sync the device, and fully restart Claude Desktop. |
| A subscription request logs `api key authentication failure` | A virtual API key policy is protecting the subscription route or its shared `Gateway`. Remove that policy from the subscription route; scope policies needed by other clients to their own `HTTPRoute`. |
| The test needs at least one model after `/v1/models` fails | Add a full model ID under **Models** and disable or skip model discovery. |
| Anthropic returns `authentication_error` in gateway API key or OIDC mode | Confirm that `policies.auth.secretRef` points to a Secret whose `Authorization` entry contains a valid Anthropic API key. |
| Anthropic returns `authentication_error` in subscription mode | Generate a new token with `claude setup-token`, confirm that the auth scheme is **Bearer**, and make sure the backend does not inject a provider API key. |
| Anthropic returns HTTP 400 in subscription mode | Add or forward `anthropic-beta: oauth-2025-04-20` as described in [Set up the Anthropic backend](#set-up-the-anthropic-backend). |
| The subscription connection test returns HTTP 429, but a normal prompt succeeds | The connection test can produce a false negative with subscription passthrough. Confirm that the real `/v1/messages` request returns HTTP 200 in the agentgateway log, and use actual inference as the final validation. |
| Normal inference returns HTTP 429 with `rate_limit_error` | The request reached Anthropic, but the subscription or API account might be at a usage limit or temporarily throttled. Check the applicable Anthropic usage dashboard or Claude usage indicator, wait for the reset, or choose an available model. See the [Claude error reference](https://code.claude.com/docs/en/errors#usage-limits). |
| No request appears in the proxy logs | Check the managed base URL, DNS, certificate, route attachment, and network path. |

## Cleanup

1. Remove the resources that you created.

   ```bash
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} claude-desktop-api-key -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} claude-desktop-buffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete httproute claude-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} anthropic-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete secret claude-desktop-client-keys anthropic-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
   ```

2. If you set up [Interactive sign-in](#sso), remove those resources too. Keep the JWKS backend if another policy uses it.

   ```bash
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} claude-desktop-jwt -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete agentgatewaybackend oidc-jwks -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Restore Claude Desktop to your original settings. For example, you might delete the `~/Library/Application Support/Claude-3p/` directory to remove third-party inference settings and use the default `~/Library/Application Support/Claude/` settings. For more information, see the [Claude docs](https://claude.com/docs/third-party/claude-desktop/overview).


## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic Provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/guardrails/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
