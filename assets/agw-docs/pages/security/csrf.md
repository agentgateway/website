Protect your web apps from Cross-Site Request Forgery (CSRF) attacks by configuring origin validation.

## About CSRF protection

According to [OWASP](https://owasp.org/www-community/attacks/csrf), CSRF is defined as follows:

> Cross-Site Request Forgery (CSRF) is an attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated. With a little help of social engineering (such as sending a link via email or chat), an attacker may trick the users of a web application into executing actions of the attacker's choosing. If the victim is a normal user, a successful CSRF attack can force the user to perform state changing requests like transferring funds, changing their email address, and so forth. If the victim is an administrative account, CSRF can compromise the entire web application.

To help prevent CSRF attacks, you can enable CSRF protection for your gateway or a specific route. For each route that you apply the CSRF policy to, the filter checks to make sure that a request's origin matches its destination. If the origin and destination do not match, a 403 Forbidden error code is returned. 

Review the following diagram to see an example CSRF request flow:
```mermaid
sequenceDiagram
    participant Attacker as Malicious Site<br/>(attacker.com)
    participant User as User's Browser
    participant AGW as AgentGateway Proxy
    participant Backend as Backend Service

    Note over Attacker,Backend: CSRF Attack Attempt

    Attacker->>User: Trick user into visiting<br/>malicious page with hidden form
    User->>AGW: POST /api/action<br/>Origin: malicioussite.com<br/>Cookie: session=abc123

    AGW->>AGW: CSRF validation:<br/>Origin (malicioussite.com)<br/>vs Destination (api.example.com)

    alt Origin does NOT match destination<br/>and NOT in additionalOrigins
        AGW-->>User: 403 Forbidden<br/>"CSRF validation failed"
        Note over User,AGW: Attack blocked
    end

    Note over User,Backend: Legitimate Request

    User->>AGW: POST /api/action<br/>Origin: allowThisOne.example.com<br/>Cookie: session=abc123

    AGW->>AGW: CSRF validation:<br/>Origin in additionalOrigins list
    AGW->>Backend: Forward request
    Backend-->>AGW: 200 OK
    AGW-->>User: 200 OK
```

{{< callout type="info" >}}
Note that because CSRF attacks specifically target state-changing requests, the filter only acts on HTTP requests that have a state-changing method such as `POST` or `PUT`.
{{< /callout >}}

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up CSRF protection

Configure an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} to enable CSRF protection for your Gateway. This policy validates the `Origin` header of incoming requests and blocks requests from untrusted origins.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with your CSRF configuration.
   ```yaml,paths="csrf"
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: csrf
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     # Target the Gateway to apply CSRF protection to all routes
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     traffic:
       csrf:
         # Additional origins that are allowed to make requests
         # These are origins beyond the request's own origin that you trust
         additionalOrigins:
         - example.org
         - allowThisOne.example.com
   EOF
   ```

   | Field | Description | 
   |-------|-------------|
   | `csrf` | Enables CSRF protection for the targeted Gateway or routes. When configured, all cross-origin requests are validated. | 
   | `additionalOrigins` | List of additional origins that are allowed to make requests to your app beyond the same-origin requests. This is useful for trusted partners, subdomains, or CDNs. Origins cannot include wildcards. | 


{{< doc-test paths="csrf" >}}
YAMLTest -f - <<'EOF'
- name: CSRF allows POST with no origin header
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/post"
    method: POST
    headers:
      host: www.example.com
  source:
    type: local
  expect:
    statusCode: 200
- name: CSRF allows POST from trusted additional origin
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/post"
    method: POST
    headers:
      host: www.example.com
      origin: allowThisOne.example.com
  source:
    type: local
  expect:
    statusCode: 200
- name: CSRF blocks POST from untrusted origin
  http:
    url: "http://${INGRESS_GW_ADDRESS}:80/post"
    method: POST
    headers:
      host: www.example.com
      origin: malicioussite.com
  source:
    type: local
  expect:
    statusCode: 403
EOF
{{< /doc-test >}}

2. Send a request to the httpbin app on the `www.example.com` domain. Include the `malicioussite.com` origin that is not allowed in your policy. Verify that the request is denied and that you get back a 403 HTTP response code.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi -X POST http://$INGRESS_GW_ADDRESS:80/post \
    -H "host: www.example.com:8080" \
    -H "origin: malicioussite.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi -X POST localhost:8080/post \
    -H "host: www.example.com" \
    -H "origin: malicioussite.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}
   
   Example output: 
   
   ```console
   * Request completely sent off
   < HTTP/1.1 403 Forbidden
   HTTP/1.1 403 Forbidden
   ...
   < 
   CSRF validation failed%
   ```

3. Send another request to the httpbin app. This time, you include the `allowThisOne.example.com` origin header that is allowed in your policy. Verify that you get back a 200 HTTP response code, because the origin matches the origin that you specified in the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource.
   
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi -X POST http://$INGRESS_GW_ADDRESS:80/post \
   -H "host: www.example.com" \
   -H "origin: allowThisOne.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi -X POST localhost:8080/post \
   -H "host: www.example.com" \
   -H "origin: allowThisOne.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}   
     
   Example output: 
   ```console
   HTTP/1.1 200 OK
   ...
   {
     "args": {},
     "headers": {
       "Accept": [
         "*/*"
       ],
       "Host": [
         "www.example.com"
       ],
       "Origin": [
         "allowThisOne.example.com"
       ],
       "User-Agent": [
         "curl/8.7.1"
       ]
     }
   ...
   ```

## Clean up

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} csrf -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
