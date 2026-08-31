---
title: OAuth2 Proxy
weight: 25
description: Add user authentication with GitHub, Google, Azure AD, and other OAuth providers by integrating agentgateway with OAuth2 Proxy.
---

Agentgateway can integrate with [OAuth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) to add user authentication through GitHub, Google, Azure AD, and other OAuth providers. Agentgateway uses an [external authorization (`extAuthz`)]({{< link-hextra path="/documentation/configuration/security/external-authz" >}}) policy to delegate authentication checks to OAuth2 Proxy, which redirects unauthenticated users to the provider's login page.

This guide uses GitHub as the example provider. For other providers, see [Use other OAuth providers](#other-providers).

## Before you begin

- [Install agentgateway]({{< link-hextra path="/documentation/quickstart/" >}}).
- [Install Docker](https://docs.docker.com/get-started/get-docker/) and make sure it is running.
- Have a GitHub account so that you can create an OAuth app.

## Step 1: Create a GitHub OAuth application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers).
2. Click **OAuth Apps** > **New OAuth App**.
3. Fill in the application details.
   - **Application name**: `agentgateway dev`, or any name you choose.
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:4180/oauth2/callback`
4. Click **Register application**.
5. Copy the **Client ID**.
6. Click **Generate a new client secret** and copy the **Client Secret**.

## Step 2: Set up your environment

1. Create a working directory.
   
   ```bash
   mkdir oauth2-proxy-test && cd oauth2-proxy-test
   ```

2. Save your GitHub OAuth credentials as environment variables.

   ```bash
   export OAUTH2_PROXY_CLIENT_ID=<your-github-client-id>
   export OAUTH2_PROXY_CLIENT_SECRET=<your-github-client-secret>
   ```

3. Generate a random cookie secret.

   ```bash
   export OAUTH2_PROXY_COOKIE_SECRET=$(python3 -c 'import os,base64; print(base64.b64encode(os.urandom(32)).decode()[:32])')
   ```

## Step 3: Start OAuth2 Proxy

1. Run OAuth2 Proxy in Docker.

   ```bash
   docker run -d --name oauth2-proxy \
     -p 4180:4180 \
     --add-host=host.docker.internal:host-gateway \
     -e OAUTH2_PROXY_CLIENT_ID=$OAUTH2_PROXY_CLIENT_ID \
     -e OAUTH2_PROXY_CLIENT_SECRET=$OAUTH2_PROXY_CLIENT_SECRET \
     -e OAUTH2_PROXY_COOKIE_SECRET=$OAUTH2_PROXY_COOKIE_SECRET \
     -e OAUTH2_PROXY_COOKIE_SECURE=false \
     quay.io/oauth2-proxy/oauth2-proxy:latest \
     --provider=github \
     --email-domain='*' \
     --upstream=file:///dev/null \
     --http-address=0.0.0.0:4180 \
     --set-xauthrequest \
     --reverse-proxy=true
   ```

2. Verify that OAuth2 Proxy is running.

   ```bash
   docker logs oauth2-proxy
   ```

   Example output:

   ```
   [2026/08/06 20:34:54] [oauthproxy.go:180] OAuthProxy configured for GitHub Client ID: $OAUTH2_PROXY_CLIENT_ID
   ```

## Step 4: Configure agentgateway

1. Create a `config.yaml` file. The configuration routes `/oauth2/*` requests to OAuth2 Proxy for login and callback handling, and protects the MCP application with an `extAuthz` policy that checks authentication and extracts the user's identity.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   frontendPolicies:
     accessLog:
       add:
         # Log the authenticated user's GitHub username and email
         github.user: 'extauthz.githubUser'
         github.email: 'extauthz.githubEmail'
   
   gateways:
     default:
       port: 3000
       protocol: HTTP
   routes:
   # Route OAuth2 Proxy endpoints (login, callback, and so on)
   - name: oauth2-proxy
     matches:
     - path:
         pathPrefix: /oauth2
     policies:
       urlRewrite:
         authority: none
     backends:
     - host: localhost:4180
   
   # Protected MCP application
   - name: application
     backends:
     - mcp:
         targets:
         - name: everything
           stdio:
             cmd: npx
             args: ["@modelcontextprotocol/server-everything"]
     policies:
       cors:
         allowOrigins: ["*"]
         allowHeaders: ["*"]
         exposeHeaders: ["Mcp-Session-Id"]
       extAuthz:
         host: localhost:4180
         includeRequestHeaders:
         - cookie
         protocol:
           http:
             # Check authentication status
             path: '"/oauth2/auth"'
             # Redirect unauthenticated users to login
             redirect: '"/oauth2/start?rd=" + request.path'
             # Extract user info from OAuth2 Proxy response headers
             metadata:
               githubUser: response.headers["x-auth-request-user"]
               githubEmail: response.headers["x-auth-request-email"]
             addRequestHeaders:
               x-forwarded-host: request.host
             includeResponseHeaders:
             - x-auth-request-user
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   |---------|-------------|
   | `frontendPolicies.accessLog.add` | Logs the GitHub username and email from authenticated requests. |
   | `routes` (`oauth2-proxy`) | Routes `/oauth2/*` requests to OAuth2 Proxy for login and callback handling. |
   | `routes` (`application`) | The protected MCP endpoint with external authorization. |
   | `extAuthz.host` | The OAuth2 Proxy address for authentication checks. |
   | `extAuthz.protocol.http.path` | The endpoint that OAuth2 Proxy uses to validate authentication. |
   | `extAuthz.protocol.http.redirect` | Where to send unauthenticated users. |
   | `extAuthz.protocol.http.metadata` | Extracts user information from the OAuth2 Proxy response headers. |

2. Start agentgateway

   ```bash
   agentgateway -f config.yaml
   ```

## Step 6: Test the authentication flow

1. Send an unauthenticated request. Because the request has no session cookie, agentgateway redirects it to the login flow.

   ```bash
   curl -i http://localhost:3000/mcp
   ```

   Example output:

   ```
   HTTP/1.1 302 Found
   location: /oauth2/start?rd=/mcp
   ```

2. Test the flow in a browser.
   1. Open [http://localhost:3000/mcp](http://localhost:3000/mcp).
   2. You are redirected to GitHub for authentication.
      
      {{< reuse-image src="/img/gh-oauth-app.png" srcDark="/img/gh-oauth-app.png" >}}

   3. After you log in, you are redirected back to the MCP endpoint.
   
   4. In the terminal where you are running agentgateway, review the logs. Notice your GitHub username and email in the `github.user` and `github.email` access log fields.

      Example output:

      ```
      2026-08-06T21:10:58.810727Z     info    request gateway=default/default listener=default route=default/application src.addr=[::1]:52638 http.method=GET http.host=localhost http.path=/ http.version=HTTP/1.1 http.status=406 protocol=mcp error="mcp: client must accept text/event-stream" reason=MCP duration=2ms github.user="<USERNAME>" github.email="<EMAIL@EXAMPLE.COM>"
      ```

## Use other OAuth providers {#other-providers}

OAuth2 Proxy supports many providers. To use a different provider, update the Docker command from [Step 3](#step-3-start-oauth2-proxy).

{{< tabs >}}
{{% tab name="Google" %}}
```bash
docker run -d --name oauth2-proxy \
  -p 4180:4180 \
  --add-host=host.docker.internal:host-gateway \
  -e OAUTH2_PROXY_CLIENT_ID=$GOOGLE_CLIENT_ID \
  -e OAUTH2_PROXY_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
  -e OAUTH2_PROXY_COOKIE_SECRET=$OAUTH2_PROXY_COOKIE_SECRET \
  -e OAUTH2_PROXY_COOKIE_SECURE=false \
  quay.io/oauth2-proxy/oauth2-proxy:latest \
  --provider=google \
  --email-domain='*' \
  --upstream=file:///dev/null \
  --http-address=0.0.0.0:4180 \
  --set-xauthrequest \
  --reverse-proxy=true
```
{{% /tab %}}
{{% tab name="Azure AD" %}}
```bash
docker run -d --name oauth2-proxy \
  -p 4180:4180 \
  --add-host=host.docker.internal:host-gateway \
  -e OAUTH2_PROXY_CLIENT_ID=$AZURE_CLIENT_ID \
  -e OAUTH2_PROXY_CLIENT_SECRET=$AZURE_CLIENT_SECRET \
  -e OAUTH2_PROXY_COOKIE_SECRET=$OAUTH2_PROXY_COOKIE_SECRET \
  -e OAUTH2_PROXY_COOKIE_SECURE=false \
  quay.io/oauth2-proxy/oauth2-proxy:latest \
  --provider=azure \
  --oidc-issuer-url=https://login.microsoftonline.com/$AZURE_TENANT_ID/v2.0 \
  --email-domain='*' \
  --upstream=file:///dev/null \
  --http-address=0.0.0.0:4180 \
  --set-xauthrequest \
  --reverse-proxy=true
```
{{% /tab %}}
{{< /tabs >}}

## Production considerations

For production deployments, consider the following.

- Set `OAUTH2_PROXY_COOKIE_SECURE=true` and use HTTPS.
- Restrict `email-domain` to your organization's domain.
- Use a persistent cookie secret instead of a randomly generated one.
- See the [OAuth2 Proxy documentation](https://oauth2-proxy.github.io/oauth2-proxy/) for additional security options.

## Cleanup

1. Stop and remove the OAuth2 Proxy container.

   ```bash
   docker stop oauth2-proxy && docker rm oauth2-proxy
   ```

2. Remove the working directory with the agentgateway config file.

   ```bash
   cd .. && rm -rf oauth2-proxy-test
   ```

3. In your GitHub account's [developer settings](https://github.com/settings/developers), delete the OAuth app.

## Learn more

{{< cards >}}
  {{< card path="/documentation/configuration/security/external-authz" title="External authorization" subtitle="ExtAuthz configuration reference" >}}
  {{< card path="/documentation/configuration/security/" title="Security configuration" subtitle="Complete security options" >}}
  {{< card link="https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-oauth2-proxy" title="traffic-oauth2-proxy example" subtitle="Agentgateway config example to start an OAuth2 proxy with Docker Compose" >}}
{{< /cards >}}
