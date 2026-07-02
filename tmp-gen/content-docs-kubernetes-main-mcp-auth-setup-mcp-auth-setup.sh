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

# Source: content/docs/kubernetes/main/setup/gateway.md:22 paths=all
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: agentgateway-proxy
  namespace: agentgateway-system
spec:
  gatewayClassName: agentgateway
  listeners:
  - protocol: HTTP
    port: 80
    name: http
    allowedRoutes:
      namespaces:
        from: All
EOF

# Hidden source: content/docs/kubernetes/main/setup/gateway.md:86 paths=all
YAMLTest -f - <<'EOF'
- name: wait for agentgateway-proxy deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for agentgateway-proxy service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
  setVars:
    INGRESS_GW_ADDRESS:
      value: true
EOF

export INGRESS_GW_ADDRESS=$(kubectl get svc -n agentgateway-system agentgateway-proxy -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")

# Hidden source: content/docs/kubernetes/main/setup/gateway.md:124 paths=all
YAMLTest -f - <<'EOF'
- name: wait for agentgateway-proxy deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5

- name: wait for agentgateway-proxy service LB address
  wait:
    target:
      kind: Service
      metadata:
        namespace: agentgateway-system
        name: agentgateway-proxy
    jsonPath: "$.status.loadBalancer.ingress[0].ip"
    jsonPathExpectation:
      comparator: exists
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/mcp/static-mcp.md:33 paths=setup-mcp-server
kubectl apply -f- <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-website-fetcher
spec:
  selector:
    matchLabels:
      app: mcp-website-fetcher
  template:
    metadata:
      labels:
        app: mcp-website-fetcher
    spec:
      containers:
      - name: mcp-website-fetcher
        image: ghcr.io/peterj/mcp-website-fetcher:main
        imagePullPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-website-fetcher
  labels:
    app: mcp-website-fetcher
spec:
  selector:
    app: mcp-website-fetcher
  ports:
  - port: 80
    targetPort: 8000
    appProtocol: agentgateway.dev/mcp
EOF

# Hidden source: content/docs/kubernetes/main/mcp/static-mcp.md:69 paths=setup-mcp-server
YAMLTest -f - <<'EOF'
- name: wait for mcp-website-fetcher deployment to be ready
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: default
        name: mcp-website-fetcher
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF

# Source: content/docs/kubernetes/main/mcp/static-mcp.md:94 paths=setup-mcp-server
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: mcp-backend
spec:
  mcp:
    targets:
    - name: mcp-target
      static:
        host: mcp-website-fetcher.default.svc.cluster.local
        port: 80
        protocol: SSE   
EOF

# Source: content/docs/kubernetes/main/mcp/static-mcp.md:136 paths=setup-mcp-server
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: agentgateway-system
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /mcp
      backendRefs:
      - name: mcp-backend
        group: agentgateway.dev
        kind: AgentgatewayBackend  
EOF

# Hidden source: content/docs/kubernetes/main/mcp/static-mcp.md:158 paths=setup-mcp-server
YAMLTest -f - <<'EOF'
- name: wait for mcp HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: default
        name: mcp
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
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

# Source: content/docs/kubernetes/main/mcp/auth/setup.md:59 paths=mcp-auth-setup
kubectl apply -f - <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: mcp-echo-authn
spec:
  # Target the HTTPRoute to apply authentication at the route level
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: mcp
  # Configure MCP authentication at the traffic (route) level
  traffic:
    jwtAuthentication:
      # Validation mode: Strict requires all claims to be valid
      mode: Strict
      providers:
      - # Issuer URL - must match the 'iss' claim in JWT tokens
        issuer: "${KEYCLOAK_ISSUER}"
        # Expected audience in JWT tokens
        audiences:
        - http://localhost:8080/mcp
        # JWKS configuration for token validation
        jwks:
          remote:
            # Reference to the Keycloak service for fetching public keys
            backendRef:
              name: keycloak
              kind: Service
              namespace: keycloak
              port: 8080
            # Path to the JWKS endpoint on the issuer
            jwksPath: "${KEYCLOAK_JWKS_PATH}"
      # MCP-specific extensions for OAuth discovery
      mcp:
        # Identity provider type
        provider: Keycloak
        # MCP resource metadata for OAuth discovery
        resourceMetadata:
          # Resource identifier for this MCP server
          resource: http://localhost:8080/mcp
          # Scopes supported by this MCP server
          scopesSupported:
          - email
          # Methods for providing bearer tokens
          bearerMethodsSupported:
          - header
          - body
          - query
EOF

# Source: content/docs/kubernetes/main/mcp/auth/setup.md:123 paths=mcp-auth-setup
kubectl get AgentgatewayPolicy mcp-echo-authn -o yaml

# Hidden source: content/docs/kubernetes/main/mcp/auth/setup.md:127 paths=mcp-auth-setup
YAMLTest -f - <<'EOF'
- name: wait for mcp-echo-authn policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: default
        name: mcp-echo-authn
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
EOF

# Source: content/docs/kubernetes/main/mcp/auth/setup.md:147 paths=mcp-auth-setup
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp
spec:
  # Reference the Agentgateway
  parentRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
    namespace: agentgateway-system
  rules:
  - filters:
     # Enable CORS for browser-based MCP clients
      - type: CORS
        cors:
          allowCredentials: true
          allowHeaders:
            - Origin
            - Authorization
            - Content-Type
          allowMethods:
            - "*"
          allowOrigins:
            - "*"
          exposeHeaders:
            - Origin
            - X-HTTPRoute-Header
          maxAge: 86400
    # Route to the MCP backend
    backendRefs:
    - group: agentgateway.dev
      kind: AgentgatewayBackend
      name: mcp-backend
    # Match MCP and OAuth discovery paths
    matches:
    # Main MCP endpoint to connect to the MCP server
    - path:
        type: PathPrefix
        value: /mcp
    # Path to access resource server metadata
    - path:
        type: PathPrefix
        value: /.well-known/oauth-protected-resource/mcp
    # Path to access authorization server metadata
    - path:
        type: PathPrefix
        value: /.well-known/oauth-authorization-server/mcp
    # JWKS endpoint for token validation
    - path:
        type: PathPrefix
        value: /realms/master/protocol/openid-connect/certs
EOF

# Hidden source: content/docs/kubernetes/main/mcp/auth/setup.md:204 paths=mcp-auth-setup
YAMLTest -f - <<'EOF'
- name: wait for mcp HTTPRoute to be accepted
  wait:
    target:
      kind: HTTPRoute
      metadata:
        namespace: default
        name: mcp
    jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 60
      intervalSeconds: 2
- name: unauthenticated MCP request returns 401 (connect-time auth enforced)
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/mcp"
    method: GET
  source:
    type: local
  expect:
    statusCode: 401
    headers:
      - name: www-authenticate
        comparator: contains
        value: resource_metadata
  retries: 3
- name: resource metadata discovery returns 200
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/.well-known/oauth-protected-resource/mcp"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.resource"
        comparator: contains
        value: "/mcp"
  retries: 3
EOF
