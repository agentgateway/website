Use an {{< reuse "agw-docs/snippets/policy.md" >}} resource to configure additional TLS settings for your listeners, such as the minimum and maximum TLS version, supported cipher suites, APN protocols, and the TLS handshake timeout. 

```yaml {paths="tls-settings"}
kubectl apply -f - <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: tls-settings
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  labels:
    app: agentgateway
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: Gateway
    name: agentgateway-proxy
  frontend: 
    tls: 
      alpnProtocols: ["h2"]
      cipherSuites: ["TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"]
      maxProtocolVersion: "1.3"
      minProtocolVersion: "1.2"
      handshakeTimeout: 5s
EOF
```

{{< doc-test paths="tls-settings" >}}
YAMLTest -f - <<'EOF'
- name: wait for tls-settings policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: agentgateway-system
        name: tls-settings
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 2
EOF
{{< /doc-test >}}

The following settings are supported: 

| Setting | Description | 
| -- | -- | 
| `alpnProtocols` | A comma-delimited list of the application protocol that the agentgateway proxy can use during a TLS handshake. In this example, `HTTP/2` is used.|
| `cipherSuites` | A comma-delimited list of the cipher suites that the agentgateway proxy can use during a TLS handshake. The example shows the `TLSv1_2` and `TLSv1_3` cipher suites.| 
| `minProtocolVersion` | Enforce a minimum TLS version for the listener to use. In this example, TLS version 1.2 is used. Supported values are `1.2` and `1.3`. |
| `maxProtocolVersion` | Enforce a maximum TLS version for the Gateway to use. In this example, TLS version 1.3 is used. Supported values are `1.2` and `1.3`. |
| `handshakeTimeout` | The time it can take for the TLS handshake to complete in seconds. If not set, defaults to 15 seconds.  |


