---
title: Remote JWKS via HTTPS
weight: 10
description:
---

Secure your applications with JSON Web Token (JWT) authentication by using the agentgateway proxy and an identity provider like Keycloak. To learn more about JWT auth, see [About JWT authentication]({{< link-hextra path="/security/jwt/about/" >}}). 

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Install Keycloak {#install}

You might want to test how to restrict access to your applications to authenticated users, such as with external auth or JWT policies. You can install Keycloak in your cluster as an OpenID Connect (OIDC) provider.

The following steps install Keycloak in your cluster, and configure two user credentials as follows.
* Username: `user1`, password: `password`, email: `user1@example.com`
* Username: `user2`, password: `password`, email: `user2@solo.io`

Install and configure Keycloak:

1. Create a namespace for your Keycloak deployment.
   ```shell
   kubectl create namespace keycloak
   ```
2. Create the Keycloak deployment.
   ```shell
   kubectl -n keycloak apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: keycloak
     namespace: keycloak
     labels:
       app: keycloak
   spec:
     ports:
     - name: http
       port: 8080
       targetPort: 8080
     - name: https
       port: 443
       targetPort: 443
     selector:
       app: keycloak
     type: LoadBalancer
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: keycloak
     namespace: keycloak
     labels:
       app: keycloak
   spec:
     replicas: 1
     selector:
       matchLabels:
        app: keycloak
     template:
       metadata:
         labels:
           app: keycloak
       spec:
         containers:
         - name: keycloak
           image: quay.io/keycloak/keycloak:26.1.3
           args: ["start-dev"]
           env:
           - name: KEYCLOAK_ADMIN
             value: "admin"
           - name: KEYCLOAK_ADMIN_PASSWORD
             value: "admin"
           - name: PROXY_ADDRESS_FORWARDING
             value: "true"
           - name: KC_PROXY
             value: "edge"
           ports:
           - name: http
             containerPort: 8080
           - name: https
             containerPort: 443
           readinessProbe:
             httpGet:
               path: /realms/master
               port: 8080
   EOF
   ```
3. Wait for the Keycloak rollout to finish.
   ```shell
   kubectl -n keycloak rollout status deploy/keycloak
   ```
4. Set the Keycloak endpoint details from the load balancer service. If you are running locally in kind and need a local IP address for the load balancer service, consider using [`cloud-provider-kind`](https://github.com/kubernetes-sigs/cloud-provider-kind).
   ```shell
   export ENDPOINT_KEYCLOAK=$(kubectl -n keycloak get service keycloak -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}'):8080
   export HOST_KEYCLOAK=$(echo ${ENDPOINT_KEYCLOAK} | cut -d: -f1)
   export PORT_KEYCLOAK=$(echo ${ENDPOINT_KEYCLOAK} | cut -d: -f2)
   export KEYCLOAK_URL=http://${ENDPOINT_KEYCLOAK}
   echo $KEYCLOAK_URL
   ```
5. Set the Keycloak admin token. If you see a parsing error, try running the `curl` command by itself. You might notice that your internet provider or network rules are blocking the requests. If so, you can update your security settings or change the network so that the request can be processed.
   ```shell
   export KEYCLOAK_TOKEN=$(curl -d "client_id=admin-cli" -d "username=admin" -d "password=admin" -d "grant_type=password" "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" | jq -r .access_token)
   echo $KEYCLOAK_TOKEN
   ```

6. Use the admin token to configure Keycloak with the two users for testing purposes. If you get a `401 Unauthorized` error, run the previous command and try again.
   ```shell
   # Create initial token to register the client
   read -r client token <<<$(curl -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" -X POST -H "Content-Type: application/json" -d '{"expiration": 0, "count": 1}' $KEYCLOAK_URL/admin/realms/master/clients-initial-access | jq -r '[.id, .token] | @tsv')
   export KEYCLOAK_CLIENT=${client}
   echo $KEYCLOAK_CLIENT

   # Register the client
   read -r id secret <<<$(curl -k -X POST -d "{ \"clientId\": \"${KEYCLOAK_CLIENT}\" }" -H "Content-Type:application/json" -H "Authorization: bearer ${token}" ${KEYCLOAK_URL}/realms/master/clients-registrations/default| jq -r '[.id, .secret] | @tsv')
   export KEYCLOAK_SECRET=${secret}
   echo $KEYCLOAK_SECRET

   # Add allowed redirect URIs
   curl -k -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" -X PUT -H "Content-Type: application/json" -d '{"serviceAccountsEnabled": true, "directAccessGrantsEnabled": true, "authorizationServicesEnabled": true, "redirectUris": ["*"]}' $KEYCLOAK_URL/admin/realms/master/clients/${id}

   # Add the group attribute in the JWT token returned by Keycloak
   curl -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" -X POST -H "Content-Type: application/json" -d '{"name": "group", "protocol": "openid-connect", "protocolMapper": "oidc-usermodel-attribute-mapper", "config": {"claim.name": "group", "jsonType.label": "String", "user.attribute": "group", "id.token.claim": "true", "access.token.claim": "true"}}' $KEYCLOAK_URL/admin/realms/master/clients/${id}/protocol-mappers/models

   # Create first user
   curl -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" -X POST -H "Content-Type: application/json" -d '{"username": "user1", "email": "user1@example.com", "firstName": "Alice", "lastName": "Doe", "enabled": true, "attributes": {"group": "users"}, "credentials": [{"type": "password", "value": "password", "temporary": false}]}' $KEYCLOAK_URL/admin/realms/master/users

   # Create second user
   curl -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" -X POST -H "Content-Type: application/json" -d '{"username": "user2", "email": "user2@solo.io", "firstName": "Bob", "lastName": "Doe", "enabled": true, "attributes": {"group": "users"}, "credentials": [{"type": "password", "value": "password", "temporary": false}]}' $KEYCLOAK_URL/admin/realms/master/users

   # Remove the trusted-hosts client registration policies (testing-purpose only)
   trusted_hosts=$(curl -v -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
    "${KEYCLOAK_URL}/admin/realms/master/components?type=org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy" \
    | jq -r '
     if type=="array" then
       .[] | select(.providerId=="trusted-hosts") | .id
     else
       empty
    end
   ')

   curl -X DELETE \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     "${KEYCLOAK_URL}/admin/realms/master/components/${trusted_hosts}"

   # Remove the allowed-client-templates client registration policies (testing-purpose only)

   allowed_client_templates=$(curl -v \
    -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
    "${KEYCLOAK_URL}/admin/realms/master/components?type=org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy" \
    | jq -r '
    .[]
     | select(.providerId=="allowed-client-templates" and .subType=="anonymous")
     | .id
   ')

   curl -X DELETE \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     "${KEYCLOAK_URL}/admin/realms/master/components/${allowed_client_templates}"
   ```

7. Open the Keycloak frontend.
   ```
   open $KEYCLOAK_URL
   ```

8. Log in to the admin console, and enter `admin` as the username and `admin` as your password. 

9. In the Keycloak admin console, go to **Users**, and verify that the users that created earlier are displayed. You might need to click on **View all users** to see them. 

10. In the Keycloak admin console, go to **Clients**, and verify that you can see a client ID that equals the output of `$KEYCLOAK_CLIENT`. 

## Retrieve JWKS path and issuer URL {#configure}

You might integrate OIDC with your apps. In such cases, you might need particular details from the OIDC provider to fully set up your apps. To use Keycloak for OAuth protection of these apps, you need certain settings and information from Keycloak.

The following instructions assume that you are still logged into the **Administration Console** from the previous step.

1. Confirm that you have the following environmental variables set. If not, refer to [Step 1: Install Keycloak](#install) section.
   ```shell
   echo $KEYCLOAK_URL
   ```

2. Get the issuer and JWKS path. The agentgateway proxy uses these values to validate the JWTs. 
    1. From the sidebar menu options, click **Realm Settings**.
    2. From the **General** tab, scroll down to the **Endpoints** section and open the **OpenID Endpoint Configuration** link. In a new tab, your browser opens to a URL similar to `http://$KEYCLOAK_URL:8080/realms/master/.well-known/openid-configuration`.
    3. In the OpenID configuration, search for the `issuer` field. Save the value as an environment variable, such as the following example. 
       ```sh
       export KEYCLOAK_ISSUER=$KEYCLOAK_URL/realms/master
       ```
    4. In the OpenID configuration, search for the `jwks_uri` field, and copy the path without the Keycloak URL that you retrieved earlier. For example, the path might be set to `/realms/master/protocol/openid-connect/certs`.
       ```shell
       export KEYCLOAK_JWKS_PATH=/realms/master/protocol/openid-connect/certs
       ```

## Set up JWT authentication

Configure an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to validate JWTs using a remote JWKS endpoint from Keycloak. This approach is recommended for production as it supports automatic key rotation.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with JWT authentication configuration.
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
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
                 port: 443
     backend:
       tls: {}
   EOF
   ```

   | Field | Description | Example |
   |-------|-------------|---------|
   | `mode` | Validation mode for JWT authentication. `Strict` requires a valid JWT for all requests. `Optional` validates JWTs if present but allows requests without tokens. `Permissive` is the least strict mode. | `Strict` |
   | `issuer` | The issuer URL that must match the `iss` claim in JWT tokens exactly. Agentgateway rejects tokens from other issuers. | `http://keycloak:8080/realms/master` |
   | `audiences` | List of allowed audience values. The JWT's `aud` claim must contain at least one of these values. If not specified, any audience is accepted. | `["my-application"]` |
   | `jwks.remote.jwksPath` | The path to the JWKS endpoint on the identity provider, relative to the backend root. This endpoint returns the public keys used to verify JWT signatures. | `/realms/master/protocol/openid-connect/certs` |
   | `jwks.remote.cacheDuration` | How long to cache the JWKS keys locally. This reduces load on the identity provider and improves performance. Keys are automatically refreshed when the cache expires. | `5m` (5 minutes) |
   | `jwks.remote.backendRef` | Reference to the Kubernetes service that hosts the identity provider. Agentgateway uses this to fetch the JWKS from the identity provider. | Keycloak service |


2. View the details of the policy. Verify that the policy is accepted.
   ```sh
   kubectl get {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} jwt-auth-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o json | jq '.status'
   ```

## Verify JWT authentication

Now that JWT authentication is configured, test the setup by obtaining a token from Keycloak and making authenticated requests.

1. Send a request to the httpbin app without any JWT token. Verify that the request fails with a 401 HTTP response code. 
   {{< tabs tabTotal= "2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -v "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
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
   
2. Get an access token from Keycloak by using the password grant type.
   ```sh
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

3. Repeat the request to the httpbin app. This time, include the JWT token that you received in the previous step. Verify that the request succeeds and you get back a 200 HTTP response code. 
   {{< tabs tabTotal= "2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -v "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "Authorization: Bearer ${ACCESS_TOKEN}"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
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
  

## Other JWT auth examples

Review other common JWT auth configuration examples that you can add to your {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}.

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

### Remote JWKS with HTTPS backends {#remote-jwks-https}

This example shows how to configure JWT authentication with a remote JWKS endpoint that uses HTTPS, such as Keycloak, Auth0, or Okta.

{{% callout type="info" %}}
**Critical:** If your JWKS endpoint uses HTTPS (port 443), you MUST create an `EnterpriseAgentgatewayPolicy` with `backend.tls` enabled. Setting port 443 in the `backendRef` does NOT automatically enable TLS. Without this policy, JWKS fetching will fail silently.
{{% /callout %}}

#### Step 1: Create a Backend for the JWKS endpoint {#backend-setup}

1. Create a Kubernetes Service that points to your OIDC provider. If your provider is external to the cluster, use an `ExternalName` service:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: keycloak
     namespace: keycloak
   spec:
     type: ExternalName
     externalName: keycloak.example.com
     ports:
     - name: https
       port: 443
       protocol: TCP
   EOF
   ```

   If your OIDC provider is running in-cluster (e.g., for testing), use the in-cluster service name:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: keycloak
     namespace: keycloak
   spec:
     ports:
     - name: https
       port: 443
       protocol: TCP
       targetPort: 8443
     selector:
       app: keycloak
   EOF
   ```

2. Create a Backend resource that references this service:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.kgateway.dev/v1alpha1
   kind: Backend
   metadata:
     name: keycloak
     namespace: keycloak
   spec:
     type: Static
     static:
       hosts:
         - host: keycloak.keycloak.svc.cluster.local
           port: 443
   EOF
   ```


   | Setting | Description |
   | --- | --- |
   | `type: Static` | Defines a static backend with explicit hosts. |
   | `hosts[].host` | The hostname of your OIDC provider. For in-cluster services, use the full service DNS name. For external services, this should match the `externalName` value. |
   | `hosts[].port` | The HTTPS port (typically 443). |

3. Create a ReferenceGrant to allow the JWT policy to access the Backend:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1beta1
   kind: ReferenceGrant
   metadata:
     name: allow-jwks-backend
     namespace: keycloak
   spec:
     from:
     - group: agentgateway.solo.io
       kind: EnterpriseAgentgatewayTrafficPolicy
       namespace: agentgateway-system
     to:
     - group: gateway.kgateway.dev
       kind: Backend
       name: keycloak
   EOF
   ```

#### Step 2: Enable TLS for the Backend {#tls-policy}

{{% callout type="info" %}}
**This step is REQUIRED for HTTPS endpoints.** Skipping it will cause silent JWKS fetch failures.
{{% /callout %}}

1. Create an `EnterpriseAgentgatewayPolicy` that enables TLS for the Backend:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: enterpriseagentgateway.solo.io/v1alpha1
   kind: EnterpriseAgentgatewayPolicy
   metadata:
     name: keycloak-tls
     namespace: keycloak
   spec:
     targetRefs:
       - group: ""
         kind: Service
         name: keycloak
     backend:
       tls: {}
   EOF
   ```

   | Setting | Description |
   | --- | --- |
   | `targetRefs` | The Kubernetes Service that the Backend uses. This MUST match the service name from Step 1. |
   | `backend.tls` | Enables TLS for connections to this backend. Use an empty object `{}` for default TLS settings. |

2. Verify the policy was created successfully:

   ```bash
   kubectl get enterpriseagentgatewaypolicy keycloak-tls -n keycloak
   ```

   Example output:
   ```
   NAME            AGE
   keycloak-tls    5s
   ```

{{% callout type="info" %}}
**For self-signed certificates** (testing only): If your OIDC provider uses self-signed certificates, add `skipVerify: true`:

```yaml
backend:
  tls:
    skipVerify: true  # WARNING: Only for testing!
```

Never use `skipVerify: true` in production environments.
{{% /callout %}}

#### Step 3: Create the JWT policy with remote JWKS {#jwt-policy}

1. Create an `EnterpriseAgentgatewayTrafficPolicy` with JWT authentication:

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.solo.io/v1alpha1
   kind: EnterpriseAgentgatewayTrafficPolicy
   metadata:
     name: jwt-keycloak
     namespace: agentgateway-system
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: http
     entJWT:
       beforeExtAuth:
         providers:
           keycloak:
             issuer: https://keycloak.example.com/realms/master
             tokenSource:
               headers:
                 - header: Authorization
                   prefix: "Bearer "
             jwks:
               remote:
                 url: https://keycloak.example.com/realms/master/protocol/openid-connect/certs
                 backendRef:
                   name: keycloak
                   namespace: keycloak
                   kind: Backend
                   group: gateway.kgateway.dev
             claimsToHeaders:
               - claim: email
                 header: x-user-email
               - claim: preferred_username
                 header: x-username
   EOF
   ```

   | Setting | Description |
   | --- | --- |
   | `targetRefs` | The Gateway or HTTPRoute to apply JWT authentication to. |
   | `entJWT.beforeExtAuth` | Apply JWT validation before external authentication. |
   | `providers.keycloak` | A unique name for this JWKS provider. |
   | `issuer` | The JWT issuer URL. Must match the `iss` claim in tokens. |
   | `tokenSource.headers` | Where to find the JWT in requests. Common values: `Authorization` with `Bearer ` prefix. |
   | `jwks.remote.url` | The full HTTPS URL to the JWKS endpoint. |
   | `jwks.remote.backendRef` | Reference to the Backend created in Step 1. |
   | `claimsToHeaders` | Extract JWT claims as HTTP headers for use by upstream services. |

2. Verify the policy status:

   ```bash
   kubectl get enterpriseagentgatewaytrafficpolicy jwt-keycloak -n agentgateway-system -o yaml
   ```

   Look for `status.conditions` with `reason: Accepted` and `status: "True"`.

#### Step 4: Test the JWT authentication {#test}

1. Send a request without a JWT token. Verify you get a 401 Unauthorized response:

   {{< tabs tabTotal= "2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```bash
   curl -vik http://$INGRESS_GW_ADDRESS:8080/get \
     -H "host: www.example.com:8080"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```bash
   curl -vik localhost:8080/get \
     -H "host: www.example.com:8080"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer realm="http://www.example.com:8080/get"
   content-length: 14

   Jwt is missing
   ```

2. Get a valid JWT token from your OIDC provider. The exact method depends on your provider:

   **For Keycloak:**
   ```bash
   export TOKEN=$(curl -Ssm 10 --fail-with-body \
     -d "client_id=${KEYCLOAK_CLIENT}" \
     -d "client_secret=${KEYCLOAK_SECRET}" \
     -d "username=user1" \
     -d "password=password" \
     -d "grant_type=password" \
     "https://keycloak.example.com/realms/master/protocol/openid-connect/token" |
     jq -r .access_token)
   ```

   **For Auth0:**
   ```bash
   export TOKEN=$(curl -Ssm 10 --fail-with-body -X POST \
     -H "Content-Type: application/json" \
     -d '{"client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET","audience":"YOUR_API_IDENTIFIER","grant_type":"client_credentials"}' \
     "https://YOUR_DOMAIN.auth0.com/oauth/token" |
     jq -r .access_token)
   ```

3. Send a request with the JWT token:

   {{< tabs tabTotal= "2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```bash
   curl -vik http://$INGRESS_GW_ADDRESS:8080/get \
     -H "host: www.example.com:8080" \
     -H "Authorization: Bearer $TOKEN"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```bash
   curl -vik localhost:8080/get \
     -H "host: www.example.com:8080" \
     -H "Authorization: Bearer $TOKEN"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```json
   HTTP/1.1 200 OK

   {
     "args": {},
     "headers": {
       "Authorization": [
         "Bearer eyJhbGc..."
       ],
       "Host": [
         "www.example.com:8080"
       ],
       "X-User-Email": [
         "user@example.com"
       ],
       "X-Username": [
         "user1"
       ]
     },
     ...
   }
   ```

   Notice that the claims you configured in `claimsToHeaders` appear as headers (`X-User-Email`, `X-Username`).

4. Verify the JWKS was fetched successfully by checking for the ConfigMap:

   ```bash
   kubectl get configmap -n agentgateway-system | grep jwks
   ```

   You should see a ConfigMap with a name like `jwks-keycloak-<hash>`. This confirms the JWKS was fetched successfully.

#### Troubleshooting {#troubleshooting}

##### "token uses the unknown key" error

This error typically indicates that the JWKS was NOT successfully fetched, not that your JWT's key ID (`kid`) is wrong.

**Diagnosis steps:**

1. **Check control plane logs** for the actual error:

   ```bash
   kubectl logs -n agentgateway-system deploy/enterprise-agentgateway | grep -i "jwks\|jwt" | tail -20
   ```

   Common errors and their causes:

   | Error in logs | Cause | Solution |
   | --- | --- | --- |
   | `error fetching jwks ... EOF` | TLS not configured for HTTPS backend | Create EnterpriseAgentgatewayPolicy with `backend.tls` (Step 2) |
   | `error fetching jwks ... connection refused` | Backend not reachable or wrong port | Verify Backend host and port, check Service exists |
   | `error fetching jwks ... 404` | Wrong JWKS URL path | Verify the `jwks.remote.url` is correct |
   | `error fetching jwks ... certificate verify failed` | Certificate validation failed | For testing only: use `tls.skipVerify: true` |
   | `error fetching jwks ... no such host` | DNS resolution failed | Verify the Service/Backend hostname is correct |

2. **Check policy status** for validation issues:

   ```bash
   kubectl get enterpriseagentgatewaytrafficpolicy jwt-keycloak -n agentgateway-system -o yaml | grep -A 10 "status:"
   ```

   Look for:
   - `reason: PartiallyValid` - Configuration issue exists
   - `reason: Accepted` with `status: "False"` - Policy was rejected
   - Messages about JWKS ConfigMap not being available

3. **Verify the TLS policy exists** (for HTTPS endpoints):

   ```bash
   kubectl get enterpriseagentgatewaypolicy -n keycloak
   ```

   If no TLS policy exists and you're using port 443, **create it** (see Step 2).

4. **Check the JWKS ConfigMap** was created:

   ```bash
   kubectl get configmap -n agentgateway-system | grep jwks
   ```

   If no ConfigMap exists, the JWKS fetch is failing. Review the control plane logs (step 1).

   If a ConfigMap exists, view its contents:

   ```bash
   kubectl get configmap <jwks-configmap-name> -n agentgateway-system -o yaml
   ```

   It should contain the public keys from your OIDC provider. If empty, the fetch succeeded but returned no keys.

##### Double-slash in JWKS URL

If the `jwks.remote.url` combines with the Backend host to produce a double slash (`//`), JWKS fetching may fail.

**Example of the problem:**
- Backend resolves to: `https://keycloak.example.com/`
- JWKS path: `/realms/master/certs`
- Result: `https://keycloak.example.com//realms/master/certs` ❌

**Solution:** Use the complete URL in `jwks.remote.url` and ensure it doesn't duplicate slashes:

```yaml
jwks:
  remote:
    url: https://keycloak.example.com/realms/master/protocol/openid-connect/certs
```

##### Issuer mismatch

If you see errors like `Jwt issuer is not configured` or requests are denied:

1. Decode your JWT to check the `iss` claim:

   ```bash
   echo $TOKEN | cut -d '.' -f 2 | base64 -d 2>/dev/null | jq .iss
   ```

2. Verify it matches **exactly** with the `issuer` field in your JWT policy (including trailing slashes).

   ❌ Mismatch: Policy has `https://keycloak.example.com/realms/master` but token has `https://keycloak.example.com/realms/master/`

   ✅ Match: Both have `https://keycloak.example.com/realms/master`

##### Policy not taking effect

If JWT validation doesn't seem to be working:

1. **Verify the policy targets the correct resource:**

   ```bash
   kubectl get enterpriseagentgatewaytrafficpolicy jwt-keycloak -n agentgateway-system -o yaml | grep -A 5 "targetRefs:"
   ```

   Make sure it targets the Gateway or HTTPRoute you're testing against.

2. **Check for conflicting policies:**

   ```bash
   kubectl get enterpriseagentgatewaytrafficpolicy -A
   ```

   Multiple JWT policies on the same target may conflict. Remove or consolidate them.

3. **Verify ReferenceGrant exists:**

   ```bash
   kubectl get referencegrant -n keycloak allow-jwks-backend
   ```

   If missing, create it (see Step 1).

## Cleanup

```bash
kubectl delete enterpriseagentgatewaytrafficpolicy jwt-keycloak -n agentgateway-system
kubectl delete enterpriseagentgatewaypolicy keycloak-tls -n keycloak
kubectl delete referencegrant allow-jwks-backend -n keycloak
kubectl delete backend keycloak -n keycloak
kubectl delete service keycloak -n keycloak
```



## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} jwt-auth-policy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete ns keycloak
```
