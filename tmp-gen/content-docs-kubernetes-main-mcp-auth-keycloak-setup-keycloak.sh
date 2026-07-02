#!/usr/bin/env bash
set -euo pipefail

# Source: content/docs/kubernetes/main/install/helm.md:38 paths=experimental
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.0/experimental-install.yaml

# Source: content/docs/kubernetes/main/install/helm.md:61 paths=standard,experimental
helm upgrade -i --create-namespace \
  --namespace agentgateway-system \
  --version 0.0.0-latest-dev agentgateway-crds oci://cr.agentgateway.dev/charts/agentgateway-crds

# Source: content/docs/kubernetes/main/install/helm.md:113 paths=experimental
helm upgrade -i -n agentgateway-system agentgateway oci://cr.agentgateway.dev/charts/agentgateway \
--version 0.0.0-latest-dev \
--set controller.image.pullPolicy=Always \
--set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true

# Hidden source: content/docs/kubernetes/main/install/helm.md:160 paths=standard,experimental
YAMLTest -f - <<'EOF'
- name: wait for agentgateway deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: verify agentgateway GatewayClass exists
  wait:
    target:
      kind: GatewayClass
      metadata:
        name: agentgateway
    jsonPath: "$.status.conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:26 paths=setup-keycloak
kubectl create namespace keycloak

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:30 paths=setup-keycloak
kubectl -n keycloak apply -f https://raw.githubusercontent.com/solo-io/gloo-mesh-use-cases/main/policy-demo/oidc/keycloak.yaml

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:34 paths=setup-keycloak
kubectl -n keycloak rollout status deploy/keycloak

# Hidden source: content/docs/kubernetes/main/mcp/auth/keycloak.md:38 paths=setup-keycloak
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

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:71 paths=setup-keycloak
export ENDPOINT_KEYCLOAK=$(kubectl -n keycloak get service keycloak -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}'):8080
export HOST_KEYCLOAK=$(echo ${ENDPOINT_KEYCLOAK} | cut -d: -f1)
export PORT_KEYCLOAK=$(echo ${ENDPOINT_KEYCLOAK} | cut -d: -f2)
export KEYCLOAK_URL=http://${ENDPOINT_KEYCLOAK}
echo $KEYCLOAK_URL

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:79 paths=setup-keycloak
export KEYCLOAK_TOKEN=$(curl -d "client_id=admin-cli" -d "username=admin" -d "password=admin" -d "grant_type=password" "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" | jq -r .access_token)
echo $KEYCLOAK_TOKEN

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:85 paths=setup-keycloak
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

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:157 paths=setup-keycloak
echo $KEYCLOAK_URL

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:165 paths=setup-keycloak
export KEYCLOAK_ISSUER=$KEYCLOAK_URL/realms/master

# Source: content/docs/kubernetes/main/mcp/auth/keycloak.md:169 paths=setup-keycloak
export KEYCLOAK_JWKS_PATH=/realms/master/protocol/openid-connect/certs
