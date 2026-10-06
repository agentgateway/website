Exchange the token that a client sends to the gateway for a Google Cloud access token at the Google Security Token Service (STS), so that Google Cloud APIs authorize each request as the end user.

## About

{{< reuse "agw-docs/snippets/te-google-about.md" >}}

### Google STS settings {#settings}

The Google STS uses the standard RFC 8693 grant, so you configure it with the generic `oauthTokenExchange` method. The following settings are specific to Google.

| Field | Value for Google |
| -- | -- |
| `host`, `path` | `sts.googleapis.com:443` and `/v1/token`. |
| `policies.backendTLS` | `{}`. A `host` port of `443` does not enable TLS by itself, so set `backendTLS` to originate TLS to the STS. |
| `grantType` | `tokenExchange`, the default. |
| `subjectToken.tokenType` | `urn:ietf:params:oauth:token-type:jwt` or `urn:ietf:params:oauth:token-type:id_token` for an OIDC provider. Google does not accept the default, `urn:ietf:params:oauth:token-type:access_token`, for an OIDC provider. |
| `requestedTokenType` | `urn:ietf:params:oauth:token-type:access_token`. Required by Google. |
| `audiences` | The full resource name of the workload identity pool provider, in the form `//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`. Note the leading `//` and the project number. |
| `scopes` | Required by Google. Use `https://www.googleapis.com/auth/cloud-platform`, or a narrower OAuth scope for the API that you call. |
| `clientAuth` | Omit. The STS does not authenticate the client. |

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Install [Docker](https://docs.docker.com/get-started/get-docker/) to run the sample identity provider.
3. Install the [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) and log in to a Google Cloud project where you can create workload identity pools and Cloud Storage buckets, such as with the `roles/iam.workloadIdentityPoolAdmin` and `roles/storage.admin` roles.
4. Install [`jq`](https://jqlang.org/download/).

## Step 1: Run a sample identity provider {#idp}

Run Keycloak as the identity provider that issues the incoming token. The realm in this example has a confidential client, `agent`, that adds the audience `agentgateway` to its tokens, and a user, `testuser`, with the password `testpass`.

Google requires the issuer to be an `https://` URL. Keycloak in this example runs on plain HTTP on your machine, so the `KC_HOSTNAME` variable pins the issuer to `https://keycloak.example.com`. Google never contacts this host, because you upload the realm's signing keys to Google instead. In production, use your own IdP and its real issuer URL.

1. Save the realm definition to a file.

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
   ```

2. Run Keycloak with the realm on port `7080`.

   ```sh
   docker run -d --name keycloak -p 7080:8080 \
     -v "$PWD/agentgateway-realm.json:/opt/keycloak/data/import/agentgateway-realm.json:ro" \
     -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
     -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
     -e KC_HOSTNAME=https://keycloak.example.com \
     quay.io/keycloak/keycloak:{{< reuse "agw-docs/versions/keycloak.md" >}} \
     start-dev --import-realm --http-port=8080
   ```

3. Wait for the realm to be served.

   ```sh
   until curl -sf http://localhost:7080/realms/agentgateway/.well-known/openid-configuration > /dev/null; do sleep 2; done
   ```

4. Mint a token for `testuser` and save it in an environment variable. Keycloak tokens expire after 5 minutes, so mint a new one if you come back to this guide later.

   ```sh
   export INBOUND_TOKEN=$(curl -s http://localhost:7080/realms/agentgateway/protocol/openid-connect/token \
     -u agent:agent-secret -d grant_type=password \
     -d username=testuser -d password=testpass | jq -r .access_token)
   ```

5. Decode the token's payload and save its `sub` claim. Google uses this claim as the identity of the federated user.

   ```sh
   echo "$INBOUND_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {iss, aud, sub}'
   export USER_SUB=$(echo "$INBOUND_TOKEN" | cut -d. -f2 | jq -rR 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | .sub')
   ```

   Example output:

   ```json
   {
     "iss": "https://keycloak.example.com/realms/agentgateway",
     "aud": "agentgateway",
     "sub": "c4bfb640-7fa6-4dcc-a742-190df95dc030"
   }
   ```

6. Save the realm's signing keys to a file, to upload to Google in the next step. The `jq` filter keeps the signing keys and drops the encryption key.

   ```sh
   curl -s http://localhost:7080/realms/agentgateway/protocol/openid-connect/certs \
     | jq '{keys: [.keys[] | select(.use == "sig")]}' > jwks.json
   ```

   Keycloak in this example keeps its keys in memory. If you restart the container, it generates new keys, and you must upload the new `jwks.json` file to the provider with `gcloud iam workload-identity-pools providers update-oidc`.

## Step 2: Set up Workload Identity Federation {#wif}

{{< reuse "agw-docs/snippets/te-google-wif-setup.md" >}}

## Step 3: Configure token exchange {#token-exchange}

1. Create a configuration file. The route forwards requests to the Cloud Storage API, and the `oauthTokenExchange` policy on the backend exchanges the incoming token at the Google STS first. The shell fills in your project number, pool ID, and provider ID.

   ```sh
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - name: google-storage
     backends:
     - host: storage.googleapis.com:443
       policies:
         backendTLS: {}
         backendAuth:
           oauthTokenExchange:
             host: sts.googleapis.com:443
             path: /v1/token
             policies:
               backendTLS: {}
             subjectToken:
               tokenType: urn:ietf:params:oauth:token-type:jwt
             requestedTokenType: urn:ietf:params:oauth:token-type:access_token
             audiences:
             - //iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID
             scopes:
             - https://www.googleapis.com/auth/cloud-platform
   EOF
   ```

   For a description of each setting, see [Google STS settings](#settings).

2. Run agentgateway with the configuration.

   ```sh
   agentgateway -f config.yaml
   ```

## Step 4: Verify the exchange {#verify}

1. In another terminal, list the objects in the bucket through the gateway, with the Keycloak token. Make sure that the `INBOUND_TOKEN` and `BUCKET` variables are set in this terminal. The gateway exchanges the Keycloak token at the Google STS, and forwards the request to Cloud Storage with the Google access token.

   ```sh
   curl -s http://localhost:3000/storage/v1/b/$BUCKET/o \
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
   curl -s -w " %{http_code}\n" http://localhost:3000/storage/v1/b/$BUCKET/o
   ```

   Example output:

   ```
   invalid request 400
   ```

The exchange does not validate the incoming token itself; Google does. To reject an invalid or expired token at the gateway before it calls the STS, add a [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) policy to the route. Set `preserveToken: true` on that policy, so that the token is still in the request when the exchange runs.

## Troubleshooting {#troubleshooting}

When the exchange fails, the gateway returns `400` with the body `invalid request`. The response from the STS is logged at debug level. To see it, run agentgateway with the `RUST_LOG=info,agentgateway::http::auth::oauth=debug` environment variable, and look for `oauth token exchange rejected by authorization server` in the output.

| Error | Cause |
| -- | -- |
| `502` with `Connection reset by peer` | The gateway connects to the STS or to Cloud Storage over plain HTTP. Set `policies.backendTLS: {}` on both the `oauthTokenExchange` method and the backend. |
| `invalid_request`: Invalid value for "audience". | The `audiences` value is not the full resource name of a provider. It must start with `//iam.googleapis.com/projects/`, not `https://`. |
| `invalid_target`: The target service indicated by the "audience" parameters is invalid. | The `audiences` value names a provider that does not exist or is disabled. Check the project number, pool ID, and provider ID. |
| `invalid_request`: Invalid value of requested_token_type in request. | Set `requestedTokenType` to `urn:ietf:params:oauth:token-type:access_token`. |
| `invalid_request`: Scope(s) must be provided. | Set at least one value in `scopes`. |
| `invalid_grant` | Google rejected the incoming token. Check that the token's `iss` matches the provider's issuer URI, that its `aud` is in the provider's allowed audiences, that the token is not expired, and that the uploaded keys are current. |

If the exchange succeeds but Cloud Storage returns `403`, the federated identity has no access to the bucket. Check that the IAM binding uses the project number and the `sub` claim of the token, and allow a few minutes for IAM changes to take effect.

## Cleanup

1. Stop agentgateway with `Ctrl+C`, and remove the Keycloak container.

   ```sh
   docker rm -f keycloak
   ```

2. Delete the Google Cloud resources.

   ```sh
   gcloud storage rm --recursive gs://$BUCKET
   gcloud iam workload-identity-pools delete $POOL_ID --project $PROJECT_ID --location global --quiet
   ```

   A deleted pool stays in a soft-deleted state for 30 days, and its ID cannot be reused during that time. To reuse the ID, restore the pool with `gcloud iam workload-identity-pools undelete`.
