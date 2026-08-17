## Install Keycloak {#install}

You might want to test how to restrict access to your applications to authenticated users, such as with external auth or JWT policies. You can install Keycloak in your cluster as an OpenID Connect (OIDC) provider.

The following steps install Keycloak in your cluster and configure a `users` group with two members.
* Username: `user1`, password: `password`, email: `user1@example.com`
* Username: `user2`, password: `password`, email: `user2@solo.io`

> [!WARNING]
> This example uses default credentials and removes Keycloak policies that restrict anonymous dynamic client registration (DCR). Use the example only in a local test environment.
>
> You can keep DCR enabled in production. Restrict redirect hosts, client templates, scopes, protocol mappers, full-scope access, and client limits. Require user consent, and prevent DCR clients from using service accounts or the client credentials grant.

Install and configure Keycloak:

1. Create a namespace for your Keycloak deployment.
   ```shell {paths="setup-keycloak"}
   kubectl create namespace keycloak
   ```
2. Create the Keycloak deployment.
   ```shell {paths="setup-keycloak"}
   kubectl -n keycloak apply -f https://raw.githubusercontent.com/solo-io/gloo-mesh-use-cases/main/policy-demo/oidc/keycloak.yaml
   ```
3. Wait for the Keycloak rollout to finish.
   ```shell {paths="setup-keycloak"}
   kubectl -n keycloak rollout status deploy/keycloak
   ```

{{< doc-test paths="setup-keycloak" >}}
YAMLTest -f - <<'EOF'
- name: wait for keycloak deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: keycloak
        name: keycloak
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: wait for keycloak service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: keycloak
        name: keycloak
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

4. Set the Keycloak endpoint details from the load balancer service. If you are running locally in kind and need a local IP address for the load balancer service, consider using [`cloud-provider-kind`](https://github.com/kubernetes-sigs/cloud-provider-kind).
   ```shell {paths="setup-keycloak"}
   export ENDPOINT_KEYCLOAK=$(kubectl -n keycloak get service keycloak -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}'):8080
   export HOST_KEYCLOAK=$(echo ${ENDPOINT_KEYCLOAK} | cut -d: -f1)
   export PORT_KEYCLOAK=$(echo ${ENDPOINT_KEYCLOAK} | cut -d: -f2)
   export KEYCLOAK_URL=http://${ENDPOINT_KEYCLOAK}
   echo $KEYCLOAK_URL
   ```
5. Set the Keycloak admin token. If you see a parsing error, try running the `curl` command by itself. You might notice that your internet provider or network rules are blocking the requests. If so, you can update your security settings or change the network so that the request can be processed.
   ```shell {paths="setup-keycloak"}
   export KEYCLOAK_TOKEN=$(curl --fail --silent --show-error \
     -d client_id=admin-cli \
     -d username=admin \
     -d password=admin \
     -d grant_type=password \
     "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
     | jq -r .access_token)
   ```

6. Use the administrator token to configure Keycloak for MCP authentication. If this command returns `401 Unauthorized`, refresh the token in the previous step.
   ```shell {paths="setup-keycloak"}
   # Use the exact public MCP server URL that clients connect to
   export MCP_RESOURCE=${MCP_RESOURCE:-http://localhost:8080/mcp}

   # Create a realm-default scope with audience and group mappers
   curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     -H "Content-Type: application/json" \
     -d "$(jq -n --arg audience "$MCP_RESOURCE" '{
       name: "mcp",
       protocol: "openid-connect",
       protocolMappers: [
         {
           name: "mcp-audience",
           protocol: "openid-connect",
           protocolMapper: "oidc-audience-mapper",
           config: {
             "included.custom.audience": $audience,
             "access.token.claim": "true"
           }
         },
         {
           name: "groups",
           protocol: "openid-connect",
           protocolMapper: "oidc-group-membership-mapper",
           config: {
             "claim.name": "groups",
             "full.path": "false",
             "access.token.claim": "true"
           }
         }
       ]
     }')" \
     "$KEYCLOAK_URL/admin/realms/master/client-scopes"

   export KEYCLOAK_SCOPE_ID=$(curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     "$KEYCLOAK_URL/admin/realms/master/client-scopes" \
     | jq -r '.[] | select(.name == "mcp") | .id')

   # Add the scope to all current and future clients
   curl --fail --silent --show-error -X PUT \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     "$KEYCLOAK_URL/admin/realms/master/default-default-client-scopes/$KEYCLOAK_SCOPE_ID"

   # Create a group for users who can access the MCP server
   curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"name":"users"}' \
     "$KEYCLOAK_URL/admin/realms/master/groups"

   export KEYCLOAK_GROUP_ID=$(curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     "$KEYCLOAK_URL/admin/realms/master/groups?search=users&exact=true" \
     | jq -r '.[] | select(.name == "users") | .id')

   # Create first user
   curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"username":"user1","email":"user1@example.com","firstName":"Alice","lastName":"Doe","enabled":true,"credentials":[{"type":"password","value":"password","temporary":false}]}' \
     "$KEYCLOAK_URL/admin/realms/master/users"

   # Create second user
   curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"username":"user2","email":"user2@solo.io","firstName":"Bob","lastName":"Doe","enabled":true,"credentials":[{"type":"password","value":"password","temporary":false}]}' \
     "$KEYCLOAK_URL/admin/realms/master/users"

   # Add both users to the group
   for username in user1 user2; do
     user_id=$(curl --fail --silent --show-error \
       -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
       "$KEYCLOAK_URL/admin/realms/master/users?username=$username&exact=true" \
       | jq -r '.[0].id')
     curl --fail --silent --show-error -X PUT \
       -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
       "$KEYCLOAK_URL/admin/realms/master/users/$user_id/groups/$KEYCLOAK_GROUP_ID"
   done

   # Relax anonymous DCR policies for this local test only
   registration_policies=$(curl --fail --silent --show-error \
     -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
     "$KEYCLOAK_URL/admin/realms/master/components?type=org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy")

   for policy_id in $(jq -r '.[] | select(
     (.providerId == "trusted-hosts") or
     (.providerId == "allowed-client-templates" and .subType == "anonymous")
   ) | .id' <<<"$registration_policies"); do
     curl --fail --silent --show-error -X DELETE \
       -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
       "$KEYCLOAK_URL/admin/realms/master/components/$policy_id"
   done
   ```

{{< doc-test paths="setup-keycloak" >}}
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
  "$KEYCLOAK_URL/admin/realms/master/client-scopes/$KEYCLOAK_SCOPE_ID/protocol-mappers/models" \
  | jq -e --arg audience "$MCP_RESOURCE" '
    any(.[]; .protocolMapper == "oidc-audience-mapper" and .config["included.custom.audience"] == $audience) and
    any(.[]; .protocolMapper == "oidc-group-membership-mapper" and .config["claim.name"] == "groups")
  ' >/dev/null

curl --fail --silent --show-error \
  -H "Authorization: Bearer ${KEYCLOAK_TOKEN}" \
  "$KEYCLOAK_URL/admin/realms/master/groups/$KEYCLOAK_GROUP_ID/members" \
  | jq -e '[.[].username] | sort == ["user1", "user2"]' >/dev/null
{{< /doc-test >}}

7. Open the Keycloak frontend.
   ```sh
   open $KEYCLOAK_URL
   ```

8. Log in to the admin console, and enter `admin` as the username and `admin` as your password. 

9. In the Keycloak admin console, go to **Users**, and verify that the users that you created are displayed. You might need to click **View all users**.

10. Go to **Groups**, select **users**, and verify that both users are listed on the **Members** tab.

## Retrieve JWKS path and issuer URL {#configure}

You might integrate OIDC with your apps. In such cases, you might need particular details from the OIDC provider to fully set up your apps. To use Keycloak for OAuth protection of these apps, you need certain settings and information from Keycloak.

The following instructions assume that you are still logged into the **Administration Console** from the previous step.

1. Confirm that you have the following environmental variables set. If not, refer to [Step 1: Install Keycloak](#install) section.
   ```shell {paths="setup-keycloak"}
   echo $KEYCLOAK_URL
   ```

2. Get the issuer and JWKS path. The agentgateway proxy uses these values to validate the JWTs. 
    1. From the sidebar menu options, click **Realm Settings**.
    2. From the **General** tab, scroll down to the **Endpoints** section and open the **OpenID Endpoint Configuration** link. In a new tab, your browser opens to a URL similar to `http://$KEYCLOAK_URL:8080/realms/master/.well-known/openid-configuration`.
    3. In the OpenID configuration, search for the `issuer` field. Save the value as an environment variable, such as the following example. 
       ```sh {paths="setup-keycloak"}
       export KEYCLOAK_ISSUER=$KEYCLOAK_URL/realms/master
       ```
    4. In the OpenID configuration, search for the `jwks_uri` field, and copy the path without the Keycloak URL that you retrieved earlier. For example, the path might be set to `/realms/master/protocol/openid-connect/certs`.
       ```shell {paths="setup-keycloak"}
       export KEYCLOAK_JWKS_PATH=/realms/master/protocol/openid-connect/certs
       ```
