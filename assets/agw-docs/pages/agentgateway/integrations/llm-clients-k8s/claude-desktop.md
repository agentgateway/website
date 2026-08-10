Configure [Claude Desktop](https://claude.com/download) to route requests through your agentgateway proxy running in Kubernetes.

## About third-party inference mode {#about}

{{< reuse "agw-docs/snippets/claude-desktop-3p.md" >}}

## Before you begin

1. Set up an [agentgateway proxy]({{< link-hextra path="/setup/gateway/" >}}).
2. Install [Claude Desktop](https://claude.com/download).
3. Decide how the proxy authenticates callers, and meet the requirements for that path.

   * **A shared token from a Claude subscription**, which [Configure Claude Desktop](#configure-claude-desktop) covers. You need a Claude Teams or Pro subscription, and the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`), which provides the `claude setup-token` command.
   * **A per-user token from your identity provider**, which [Authenticate users with your identity provider](#sso) covers. You need an OIDC provider and an Anthropic API key for the proxy to send upstream.

## Get the gateway URL {#gateway-url}

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

> [!IMPORTANT]
> **Claude Desktop accepts a plain HTTP gateway URL only on a loopback address.** Any other host must use HTTPS. A plain HTTP URL that points to a LoadBalancer address or a hostname fails validation when you test the connection, with the error `Invalid custom3p enterprise config: baseUrl: must use https (or http on loopback)`.
>
> You therefore have two options:
>
> * **Port-forward the proxy** and use `http://127.0.0.1:<port>`. Use the literal address `127.0.0.1`, because `localhost` does not always resolve as a loopback address for this check. Choose this option to try out the setup on a single machine.
> * **Terminate HTTPS on the proxy** and use `https://<hostname>`. Choose this option when you [roll out the configuration to your organization](#mdm), because each user's machine must reach the proxy over the network. To set up a certificate, see [HTTPS listeners]({{< link-hextra path="/setup/listeners/https/" >}}).

## Set up the Anthropic backend

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the Anthropic provider. No API key is needed because authentication uses your Claude subscription via OAuth.

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
       ai:
         routes:
           '/v1/messages': Messages
           '/v1/messages/count_tokens': AnthropicTokenCount
           '*': Passthrough
   EOF
   ```

2. Create an `{{< reuse "agw-docs/snippets/policy.md" >}}` to raise the body buffer limit to 10 MB for the OAuth token flow.

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
       kind: Gateway
       name: agentgateway-proxy
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

3. Create an `HTTPRoute` that matches the `/claude` path prefix and rewrites it to `/` before forwarding to the backend.

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

## Configure Claude Desktop

1. Get a bearer token for your Claude account. Store the value in a safe place.

   ```bash
   claude setup-token
   ```

2. Open Claude Desktop and enable developer mode from the menu bar: **Help → Troubleshooting → Enable Developer Mode**. Then fully quit and relaunch Claude Desktop. A new **Developer** menu appears in the menu bar.

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the **Gateway base URL**. Remember that a host other than a loopback address must use HTTPS, as described in [Get the gateway URL](#gateway-url).

   {{< tabs >}}

   {{% tab name="HTTPS listener" %}}
   Use the hostname that your gateway certificate covers.

   ```
   https://$INGRESS_GW_HOSTNAME/claude
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

5. For the **Credential kind** dropdown, select `Static API key` and then in the **Gateway API key** field, enter the bearer token you copied in step 1. To authenticate each user with your identity provider instead of requiring users to pass the same shared token, see [Authenticate users with your identity provider](#sso).

6. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. Claude Desktop reads its configuration only at launch.

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

## Authenticate users with your identity provider {#sso}

A static API key gives every user the same credential, which you cannot attribute to a person and cannot revoke for one user alone. Instead, select the **Interactive sign-in** credential kind. Claude Desktop then runs an OAuth 2.0 authorization code flow with Proof Key for Code Exchange (PKCE) against your identity provider, and sends the resulting token on every inference request. The proxy validates the token and adds the LLM provider credential itself, so the user's device never holds a provider API key. When you offboard a user in your identity provider, that user loses access to the proxy.

The following steps use Microsoft Entra ID as the example identity provider. Any OpenID Connect (OIDC) provider works the same way. Substitute your own issuer URL, client ID, and JWKS path.

1. Register an application with your identity provider, and record the client ID and the issuer URL. Claude Desktop is a public client that receives the redirect on a loopback address, so configure the application accordingly.

   | Setting | Value |
   | -- | -- |
   | Client type | Public client. Claude Desktop holds no client secret. |
   | Redirect URI | `http://127.0.0.1/callback` |
   | Scopes | `openid profile email offline_access` |

   > [!IMPORTANT]
   > Two details about the redirect URI cause most failures:
   >
   > * Include the `/callback` path. Claude Desktop redirects to `http://127.0.0.1:<port>/callback`, and a registration of `http://127.0.0.1` alone does not match. On Entra ID, the mismatch returns `AADSTS50011`.
   > * Register the URI as a native or desktop client, not a web client. Claude Desktop picks an ephemeral port for each sign-in. A native client registration accepts any loopback port, as described in [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3), and a web client registration requires an exact port match. On Entra ID, select the **Mobile and desktop applications** platform and set **Allow public client flows** to **Yes**.

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

   > [!WARNING]
   > **Set the bearer token type to ID token.** With the access token setting, Entra ID returns a Microsoft Graph token that its own service signs, and validation against your tenant JWKS always fails with `InvalidSignature`. The ID token carries the client ID as its audience, which matches the `audiences` value in the policy.

7. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. A browser window opens to your identity provider. After you sign in, Claude Desktop stores the token and refreshes it in the background through the `offline_access` scope.

8. Confirm that the proxy sees the authenticated identity.

   ```bash
   kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --tail=5
   ```

   Each request now carries the `sub` claim of the signed-in user.

## Send custom headers {#headers}

Use the **Custom inference headers** field to add a header to every inference request, such as a tenant identifier that a route or a policy matches on. Claude Desktop sends these headers on requests from Chat, Cowork, and Code alike.

To supply a header value that changes over time, set a credential helper instead. A credential helper is an executable that Claude Desktop runs with no arguments and that prints either a bare token or a JSON object in the form `{"token": "...", "headers": {"Name": "Value"}}`. Claude Desktop caches the result and re-runs the helper when the cache expires, with no prompt and no relaunch. Helper headers override custom inference headers of the same name, and a configured helper replaces any static API key. Use a helper to read a short-lived credential from a secret store.

## Roll out to your organization {#mdm}

Configure and test one machine in developer mode first. When the connection works, click **Export** in the **Configure Third Party Inference** panel to produce a profile for your device management system, and distribute it with the tool that you already use, such as Jamf, Intune, Workspace ONE, or Group Policy. Users then receive the configuration on first launch and do not configure anything by hand.

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
  "inferenceGatewayOidc": {
    "issuer": "https://login.microsoftonline.com/$TENANT_ID/v2.0",
    "clientId": "$CLIENT_ID",
    "scopes": "openid profile email offline_access",
    "bearerTokenType": "id_token"
  },
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

## Cleanup

1. Remove the resources that you created.

   ```bash
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} claude-desktop-buffer -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete httproute claude-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} anthropic-desktop -n {{< reuse "agw-docs/snippets/namespace.md" >}}
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
