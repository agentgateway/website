---
title: OAuth2 Proxy Integration
weight: 10
description: Integrate with OAuth2 Proxy for GitHub, Google, and other OAuth providers
---

Agent Gateway can integrate with [OAuth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) to add authentication using GitHub, Google, Azure AD, and other OAuth providers.

## What you'll build

In this tutorial, you'll:
1. Create a GitHub OAuth application for authentication
2. Set up OAuth2 Proxy with Docker
3. Configure Agent Gateway to use external authorization
4. Protect MCP endpoints with OAuth login
5. Extract and log user identity from authenticated requests

## Prerequisites

- [Agent Gateway installed]({{< link-hextra path="/quickstart/" >}})
- [Docker](https://docs.docker.com/get-started/get-docker/) installed and running
- A GitHub account (for creating an OAuth app)

## Step 1: Create a GitHub OAuth Application

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in the application details:
   - **Application name**: `Agent Gateway Dev` (or any name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:4180/oauth2/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy the **Client Secret**

## Step 2: Set up your environment

Create a working directory and set your credentials:

```bash
mkdir oauth2-proxy-test && cd oauth2-proxy-test

# Set your GitHub OAuth credentials
export OAUTH2_PROXY_CLIENT_ID=your-github-client-id
export OAUTH2_PROXY_CLIENT_SECRET=your-github-client-secret

# Generate a random cookie secret
export OAUTH2_PROXY_COOKIE_SECRET=$(python3 -c 'import os,base64; print(base64.b64encode(os.urandom(32)).decode()[:32])')
```

## Step 3: Start OAuth2 Proxy

Run OAuth2 Proxy in Docker:

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
  --email-domain=* \
  --upstream=file:///dev/null \
  --http-address=0.0.0.0:4180 \
  --set-xauthrequest \
  --reverse-proxy=true
```

Verify it's running:

```bash
docker logs oauth2-proxy
```

## Step 4: Create the Agent Gateway configuration

Create a `config.yaml` file:

```bash
cat > config.yaml << 'EOF'
frontendPolicies:
  accessLog:
    add:
      # Log the authenticated user's GitHub username and email
      github.user: 'extauthz.githubUser'
      github.email: 'extauthz.githubEmail'

binds:
- port: 3000
  listeners:
  - name: default
    protocol: HTTP
    routes:
    # Route OAuth2 Proxy endpoints (login, callback, etc.)
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
EOF
```

### Configuration explained

| Setting | Description |
|---------|-------------|
| `frontendPolicies.accessLog.add` | Log GitHub username/email from authenticated requests |
| `routes[0]` (oauth2-proxy) | Routes `/oauth2/*` requests to OAuth2 Proxy for login/callback |
| `routes[1]` (application) | Protected MCP endpoint with external authorization |
| `extAuthz.host` | OAuth2 Proxy address for auth checks |
| `extAuthz.protocol.http.path` | Endpoint OAuth2 Proxy uses to validate auth |
| `extAuthz.protocol.http.redirect` | Where to send unauthenticated users |
| `extAuthz.protocol.http.metadata` | Extract user info from OAuth2 Proxy headers |

## Step 5: Start Agent Gateway

```bash
agentgateway -f config.yaml
```

## Step 6: Test the authentication flow

### Test unauthenticated access

```bash
curl -i http://localhost:3000/mcp
```

**Expected response** (redirect to login):
```
HTTP/1.1 302 Found
location: /oauth2/start?rd=/mcp
```

### Test in browser

1. Open [http://localhost:3000/mcp](http://localhost:3000/mcp) in your browser
2. You'll be redirected to GitHub for authentication
3. After logging in, you'll be redirected back to the MCP endpoint
4. The Agent Gateway logs will show your GitHub username and email

### Verify user info in logs

After authenticating, check the Agent Gateway logs:

```bash
# Look for github.user and github.email in the access log
```

## Authentication flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────┐
│  Client  │────▶│Agent Gateway │────▶│OAuth2 Proxy │────▶│ GitHub │
└──────────┘     └──────────────┘     └─────────────┘     └────────┘
     │                  │                    │                 │
     │ 1. Request /mcp  │                    │                 │
     │─────────────────▶│                    │                 │
     │                  │ 2. Check auth      │                 │
     │                  │───────────────────▶│                 │
     │                  │ 3. 401 (no cookie) │                 │
     │                  │◀───────────────────│                 │
     │ 4. 302 Redirect  │                    │                 │
     │◀─────────────────│                    │                 │
     │ 5. Login page    │                    │                 │
     │─────────────────────────────────────▶│                 │
     │                  │                    │ 6. OAuth flow   │
     │                  │                    │◀───────────────▶│
     │ 7. Set cookie    │                    │                 │
     │◀────────────────────────────────────│                 │
     │ 8. Request /mcp  │                    │                 │
     │  (with cookie)   │                    │                 │
     │─────────────────▶│                    │                 │
     │                  │ 9. Check auth      │                 │
     │                  │───────────────────▶│                 │
     │                  │ 10. 202 + headers  │                 │
     │                  │◀───────────────────│                 │
     │ 11. MCP response │                    │                 │
     │◀─────────────────│                    │                 │
```

## Using other OAuth providers

OAuth2 Proxy supports many providers. Update the Docker command:

### Google

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
  --email-domain=* \
  --upstream=file:///dev/null \
  --http-address=0.0.0.0:4180 \
  --set-xauthrequest \
  --reverse-proxy=true
```

### Azure AD

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
  --email-domain=* \
  --upstream=file:///dev/null \
  --http-address=0.0.0.0:4180 \
  --set-xauthrequest \
  --reverse-proxy=true
```

## Cleanup

Stop and remove the containers:

```bash
docker stop oauth2-proxy && docker rm oauth2-proxy
cd .. && rm -rf oauth2-proxy-test
```

## Production considerations

For production deployments:

- Set `OAUTH2_PROXY_COOKIE_SECURE=true` and use HTTPS
- Restrict `email-domain` to your organization's domain
- Use a persistent cookie secret (not randomly generated)
- See the [OAuth2 Proxy documentation](https://oauth2-proxy.github.io/oauth2-proxy/) for additional security options

## Learn more

{{< cards >}}
  {{< card link="/docs/configuration/security/" title="Security Configuration" subtitle="Complete security options" >}}
  {{< card link="/docs/configuration/traffic-management/external-authorization/" title="External Authorization" subtitle="ExtAuthz configuration reference" >}}
{{< /cards >}}
