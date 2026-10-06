Exchange the token that a client sends to the gateway for a Google Cloud access token at the Google Security Token Service (STS), so that Google Cloud APIs authorize each request as the end user.

## About

{{< reuse "agw-docs/snippets/te-google-about.md" >}}

### Google STS settings {#settings}

The Google STS uses the standard RFC 8693 grant, so you configure it with the generic `oauthTokenExchange` method. The following settings are specific to Google.

| Field | Value for Google |
| -- | -- |
| `url` | `https://sts.googleapis.com/v1/token`. Because the scheme is `https`, the gateway originates TLS to the STS. |
| `grantType` | `TokenExchange`, the default. |
| `subjectToken.tokenType` | `Jwt` or `IdToken` for an OIDC provider. Google does not accept the default, `AccessToken`, for an OIDC provider. |
| `requestedTokenType` | `AccessToken`. Required by Google. |
| `audiences` | The full resource name of the workload identity pool provider, in the form `//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`. Note the leading `//` and the project number. |
| `scopes` | Required by Google. Use `https://www.googleapis.com/auth/cloud-platform`, or a narrower OAuth scope for the API that you call. |
| `clientAuth` | Omit. The STS does not authenticate the client. |

{{% downstream %}}
You can also use the `entTokenExchange.google` preset, which sets these values for you. For an example, see [Optional: Use the Google preset](#google-preset).
{{% /downstream %}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

4. Install the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) and log in to a Google Cloud project where you can create workload identity pools and Cloud Storage buckets, such as with the `roles/iam.workloadIdentityPoolAdmin` and `roles/storage.admin` roles.

5. Install [`jq`](https://jqlang.org/download/).

## Step 1: Deploy a sample identity provider {#idp}

Deploy Keycloak as the identity provider that issues the incoming token. The realm in this example has a confidential client, `agent`, that adds the audience `agentgateway` to its tokens, and a user, `testuser`, with the password `testpass`.

Google requires the issuer to be an `https://` URL. Keycloak in this example runs on plain HTTP inside the cluster, so the `KC_HOSTNAME` variable pins the issuer to `https://keycloak.example.com`. Google never contacts this host, because you upload the realm's signing keys to Google instead. In production, use your own IdP and its real issuer URL.

1. Save the realm definition to a file and load it into a ConfigMap.

   ```sh
   cat > agentgateway-realm.json <<'EOF'
   {
     "realm": "agentgateway",
     "enabled": true,
     "clients": [
       {
         "clientId": "agent",
         "secret": "agent-secret",
         "publicClient": false,
         "standardFlowEnabled": false,
         "directAccessGrantsEnabled": true,
         "protocolMappers": [
           {
             "name": "google-audience",
             "protocol": "openid-connect",
             "protocolMapper": "oidc-audience-mapper",
             "config": {
               "included.custom.audience": "agentgateway",
               "access.token.claim": "true"
             }
           }
         ]
       }
     ],
     "users": [
       {
         "username": "testuser",
         "enabled": true,
         "email": "testuser@example.com",
         "emailVerified": true,
         "firstName": "Test",
         "lastName": "User",
         "credentials": [{"type": "password", "value": "testpass", "temporary": false}]
       }
     ]
   }
   EOF

   kubectl create configmap keycloak-realm -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-file=agentgateway-realm.json
   ```

2. Deploy Keycloak and its Service.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: keycloak
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
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
           image: quay.io/keycloak/keycloak:{{< reuse "agw-docs/versions/keycloak.md" >}}
           args: ["start-dev", "--import-realm", "--http-port=8080"]
           env:
           - name: KC_BOOTSTRAP_ADMIN_USERNAME
             value: admin
           - name: KC_BOOTSTRAP_ADMIN_PASSWORD
             value: admin
           - name: KC_HOSTNAME
             value: https://keycloak.example.com
           ports:
           - containerPort: 8080
           volumeMounts:
           - name: realm
             mountPath: /opt/keycloak/data/import
             readOnly: true
         volumes:
         - name: realm
           configMap:
             name: keycloak-realm
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: keycloak
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     selector:
       app: keycloak
     ports:
     - name: http
       port: 8080
       targetPort: 8080
   EOF
   ```

3. Wait for Keycloak to be ready.

   ```sh
   kubectl rollout status deployment/keycloak -n {{< reuse "agw-docs/snippets/namespace.md" >}} --timeout=180s
   ```

4. Port-forward the Keycloak Service so that you can reach it locally.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/keycloak 8081:8080
   ```

5. In another terminal, mint a token for `testuser` and save it in an environment variable. Keycloak tokens expire after 5 minutes, so mint a new one if you come back to this guide later.

   ```sh
   export INBOUND_TOKEN=$(curl -s http://localhost:8081/realms/agentgateway/protocol/openid-connect/token \
     -u agent:agent-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)
   ```

6. Decode the token's payload and save its `sub` claim. Google uses this claim as the identity of the federated user.

   ```sh
   echo "$INBOUND_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {iss, aud, sub}'
   export USER_SUB=$(echo "$INBOUND_TOKEN" | cut -d. -f2 | jq -rR 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | .sub')
   ```

   Example output:

   ```json
   {
     "iss": "https://keycloak.example.com/realms/agentgateway",
     "aud": "agentgateway",
     "sub": "c44ff2c5-1833-4e88-ad28-780f41d48e47"
   }
   ```

7. Save the realm's signing keys to a file, to upload to Google in the next step. The `jq` filter keeps the signing keys and drops the encryption key.

   ```sh
   curl -s http://localhost:8081/realms/agentgateway/protocol/openid-connect/certs \
     | jq '{keys: [.keys[] | select(.use == "sig")]}' > jwks.json
   ```

   Keycloak in this example keeps its keys in memory. If the Keycloak pod restarts, it generates new keys, and you must upload the new `jwks.json` file to the provider with `gcloud iam workload-identity-pools providers update-oidc`.

## Step 2: Set up Workload Identity Federation {#wif}

{{< reuse "agw-docs/snippets/te-google-wif-setup.md" >}}

## Step 3: Route to Google Cloud Storage {#route}

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the Cloud Storage API. The `tls` policy originates TLS to the backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: google-storage
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: storage.googleapis.com
       port: 443
     policies:
       tls:
         sni: storage.googleapis.com
   EOF
   ```

2. Create an HTTPRoute that sends requests for the `storage.example.com` host to the backend, and rewrites the host to `storage.googleapis.com`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: google-storage
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     hostnames:
     - storage.example.com
     rules:
     - backendRefs:
       - group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         name: google-storage
       filters:
       - type: URLRewrite
         urlRewrite:
           hostname: storage.googleapis.com
   EOF
   ```

3. List the objects in the bucket through the gateway, with the Keycloak token. Without a token exchange, the gateway forwards the Keycloak token unchanged, and Cloud Storage rejects it with a `401` response, because it is not a Google credential.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS/storage/v1/b/$BUCKET/o \
     -H "host: storage.example.com" \
     -H "authorization: Bearer $INBOUND_TOKEN"
   ```

## Step 4: Configure token exchange {#token-exchange}

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that exchanges the incoming token at the Google STS for every request to the Cloud Storage backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: google-token-exchange
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: {{< reuse "agw-docs/snippets/group.md" >}}
       kind: {{< reuse "agw-docs/snippets/backend.md" >}}
       name: google-storage
     backend:
       auth:
         oauthTokenExchange:
           url: https://sts.googleapis.com/v1/token
           grantType: TokenExchange
           subjectToken:
             tokenType: Jwt
           requestedTokenType: AccessToken
           audiences:
           - //iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID
           scopes:
           - https://www.googleapis.com/auth/cloud-platform
   EOF
   ```

   For a description of each setting, see [Google STS settings](#settings).

2. Confirm that the policy is accepted and attached.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} google-token-exchange -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{range .status.ancestors[0].conditions[*]}{.type}={.status}{"\n"}{end}'
   ```

   Example output:

   ```
   Accepted=True
   Attached=True
   ```

{{% downstream %}}
### Optional: Use the Google preset {#google-preset}

Instead of the generic `oauthTokenExchange` method, you can configure the exchange with the `entTokenExchange.google` preset. The preset sets the token endpoint path to `/v1/token`, the grant to `TokenExchange`, the subject token type to `Jwt`, the requested token type to `AccessToken`, and the scope to `https://www.googleapis.com/auth/cloud-platform`, so you set only the provider and the token endpoint backend.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the STS token endpoint. Unlike the generic method, the preset does not take a `url`, so it references the STS through a backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: google-sts
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     static:
       host: sts.googleapis.com
       port: 443
     policies:
       tls:
         sni: sts.googleapis.com
   EOF
   ```

2. Replace the policy with one that uses the preset.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: google-token-exchange
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: {{< reuse "agw-docs/snippets/group.md" >}}
       kind: {{< reuse "agw-docs/snippets/backend.md" >}}
       name: google-storage
     backend:
       entTokenExchange:
         google:
           audience: //iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID
           backendRef:
             group: {{< reuse "agw-docs/snippets/group.md" >}}
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
             name: google-sts
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `audience` | The full resource name of the workload identity pool provider. |
   | `backendRef` | The backend for the STS token endpoint. |
   | `scopes` | Optional. Defaults to `https://www.googleapis.com/auth/cloud-platform`. |
   | `subjectTokenType` | Optional. Defaults to `Jwt`. Set `IdToken` if your IdP issues ID tokens. |
{{% /downstream %}}

## Step 5: Verify the exchange {#verify}

1. Send the same request again. The gateway exchanges the Keycloak token at the Google STS, and forwards the request to Cloud Storage with the Google access token.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS/storage/v1/b/$BUCKET/o \
     -H "host: storage.example.com" \
     -H "authorization: Bearer $INBOUND_TOKEN"
   ```

   Cloud Storage authorizes the request as the federated `testuser` identity, and returns the objects in the bucket.

   ```json
   {
     "kind": "storage#objects",
     "items": [
       {
         "kind": "storage#object",
         "name": "hello.txt",
         "bucket": "agentgateway-te-my-project",
         ...
       }
     ]
   }
   ```

2. Send a request without a token. The gateway has no subject token to exchange, so it rejects the request with a `400` response and does not call the STS.

   ```sh
   curl -s -w " %{http_code}\n" http://$INGRESS_GW_ADDRESS/storage/v1/b/$BUCKET/o \
     -H "host: storage.example.com"
   ```

   Example output:

   ```
   invalid request 400
   ```

The exchange does not validate the incoming token itself; Google does. To reject an invalid or expired token at the gateway before it calls the STS, add a JWT authentication policy, as described in [Validate the incoming token at the edge]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#edge-validation" >}}). Set `preserveToken: true` on that policy, so that the token is still in the request when the exchange runs.

## Troubleshooting {#troubleshooting}

When the exchange fails, the gateway returns `400` with the body `invalid request`. The response from the STS is logged at debug level. To see it, raise the log level of the token exchange module on the proxy, send the request again, and check the proxy logs.

```sh
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &
curl -X POST "http://localhost:15000/logging?level=info,agentgateway::http::auth::oauth=debug"
kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep "oauth token exchange"
```

The change lasts until the proxy restarts. Look for a message such as `oauth token exchange rejected by authorization server`, which includes the error from the STS.

| Error from the STS | Cause |
| -- | -- |
| `invalid_request`: Invalid value for "audience". | The `audiences` value is not the full resource name of a provider. It must start with `//iam.googleapis.com/projects/`, not `https://`. |
| `invalid_target`: The target service indicated by the "audience" parameters is invalid. | The `audiences` value names a provider that does not exist or is disabled. Check the project number, pool ID, and provider ID. |
| `invalid_request`: Invalid value of requested_token_type in request. | Set `requestedTokenType` to `AccessToken`. |
| `invalid_request`: Scope(s) must be provided. | Set at least one value in `scopes`. |
| `invalid_grant` | Google rejected the incoming token. Check that the token's `iss` matches the provider's issuer URI, that its `aud` is in the provider's allowed audiences, that the token is not expired, and that the uploaded keys are current. |

If the exchange succeeds but Cloud Storage returns `403`, the federated identity has no access to the bucket. Check that the IAM binding uses the project number and the `sub` claim of the token, and allow a few minutes for IAM changes to take effect.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the Kubernetes resources.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} google-token-exchange -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete httproute google-storage -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} google-storage -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete deployment keycloak -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete service keycloak -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl delete configmap keycloak-realm -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

{{% downstream %}}
   If you used the Google preset, also delete the STS backend.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} google-sts -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
{{% /downstream %}}

2. Delete the Google Cloud resources.

   ```sh
   gcloud storage rm --recursive gs://$BUCKET
   gcloud iam workload-identity-pools delete $POOL_ID --project $PROJECT_ID --location global --quiet
   ```

   A deleted pool stays in a soft-deleted state for 30 days, and its ID cannot be reused during that time. To reuse the ID, restore the pool with `gcloud iam workload-identity-pools undelete`.
