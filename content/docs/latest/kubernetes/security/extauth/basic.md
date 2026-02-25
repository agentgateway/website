---
title: Basic auth
weight: 10
description: Set up basic auth to secure requests to an LLM, MCP server, or agent.
---

[Basic authentication](https://en.wikipedia.org/wiki/Basic_access_authentication) sends encoded user credentials in a standard header within the request. Then, the agentgateway proxy authenticates the request against a dictionary of usernames and passwords that is stored in an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource. If the credentials in the `Authorization` request header match the credentials in the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource, the request is authenticated and forwarded to the destination. If not, the proxy returns a 401 response.

The agentgateway proxy requires the password that the user uses to authenticate to be hashed and [salted](https://en.wikipedia.org/wiki/Salt_(cryptography)) by using the [APR1](https://httpd.apache.org/docs/2.4/misc/password_encryptions.html) format. Passwords in this format follow the following pattern: `$apr1$SALT$HASHED_PASSWORD`. You can use tools, such as `htpasswd` to generate a salt and hashed password. 

To set up basic auth, you use the following APIs:

* **AuthConfig**: Set up the basic dictionary of usernames and passwords that you want to allow.
* **{{< reuse "agw-docs/snippets/trafficpolicy.md" >}}**: Instruct the proxy to use the AuthConfig. This way, requests that this policy applies to, such as a Gateway or HTTPRoute, enforce external auth.

## About this guide

This guide walks you through how to set up basic key auth for the OpenAI LLM provider. However, you can use the same steps to secure an MCP server or agent. 

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

3. Make sure that you have the following CLI tools, or something comparable:
   * `htpasswd` to generate hashed, salted passwords.
   * `base64` to encode strings.
 

## Set up basic auth {#basic-policy-config}

1. Generate a [salt](https://en.wikipedia.org/wiki/Basic_access_authentication) and hashed password for your user credentials. The following example uses the `htpasswd` tool for a user named `user`.
   ```shell
   htpasswd -nbm user password
   ```
   Example output:
   ```
   user:$apr1$TYiryv0/$8BvzLUO9IfGPGGsPnAgSu1
   ```

   In the example output, you can see the following information: 
   * Salt: `TYiryv0/`
   * Hashed password: `8BvzLUO9IfGPGGsPnAgSu1`

2. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with your basic auth policy. The following example uses the inline approach to provide the user and hashed password. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: basic-auth
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy
     traffic:
       basicAuthentication:
         mode: Strict
         users: 
         - "user:\$apr1\$TYiryv0/\$8BvzLUO9IfGPGGsPnAgSu1"
   EOF
   ```

3. Send a request to the httpbin app without any credentials. Verify that the request fails with a 401 HTTP response code. 
   
   {{< tabs tabTotal= "2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com"                                  
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/headers" -H "host: www.example.com" 
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   ...
   < HTTP/1.1 401 Unauthorized
   HTTP/1.1 401 Unauthorized

   basic authentication failure: no basic authentication credentials found%   
   ...
   ```

4. Encode the expected user credentials in base64 format.
   ```sh
   echo -n "user:password" | base64
   ```

   Example output: 
   ```
   dXNlcjpwYXNzd29yZA==
   ```

5. Repeat the request. This time, you include the base64 user credentials in an `Authorization` header. Verify that the request now succeeds and returns. 
   {{< tabs tabTotal= "2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi "${INGRESS_GW_ADDRESS}:80/headers" \
   -H "host: www.example.com" \
   -H "Authorization: basic dXNlcjpwYXNzd29yZA=="                                 
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi "localhost:8080/headers" \
   -H "host: www.example.com" \
   -H "Authorization: basic dXNlcjpwYXNzd29yZA=="  
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```
   ...
   * Request completely sent off
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   < access-control-allow-credentials: true
   access-control-allow-credentials: true
   < access-control-allow-origin: *
   access-control-allow-origin: *
   < content-type: application/json; encoding=utf-8
   content-type: application/json; encoding=utf-8
   < content-length: 148
   content-length: 148
   < 
   
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
   ...
    
   ```

## Cleanup 

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} basic-auth -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Other configuration examples

### Secret reference

Instead of providing user credentials inline, you can store them in a Kubernetes secret. The secret must contain a key named `.htaccess` with the credentials in htpasswd format.

1. Create a secret with your user credentials.

   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: basic-auth-secret
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   stringData:
     .htaccess: |
       alice:$apr1$3zSE0Abt$IuETi4l5yO87MuOrbSE4V.
       bob:$apr1$Ukb5LgRD$EPY2lIfY.A54jzLELNIId/
   EOF
   ```

2. Reference the secret in your {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: basic-auth
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - group: gateway.networking.k8s.io
         kind: Gateway
         name: agentgateway-proxy
     traffic:
       basicAuthentication:
         mode: Strict
         secretRef:
           name: basic-auth-secret
   EOF
   ```

### Multiple users

Add multiple users by including additional entries in the `users` array.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: basic-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    basicAuthentication:
      mode: Strict
      users:
        - "admin:\$apr1\$TYiryv0/\$8BvzLUO9IfGPGGsPnAgSu1"
        - "developer:\$apr1\$abc123/\$xyz789ExampleHash"
        - "readonly:\$2y\$05\$r3J4d3VepzFkedkd/q1vI.pBYIpSqjfN0qOARV3ScUHysatnS0cL2"
EOF
```

### Custom realm

Set a custom realm that appears in the browser's authentication dialog and the `WWW-Authenticate` response header.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: basic-auth
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    basicAuthentication:
      mode: Strict
      realm: "My Protected API"
      users:
        - "user:\$apr1\$TYiryv0/\$8BvzLUO9IfGPGGsPnAgSu1"
EOF
```

### Optional validation mode

Use the `Optional` mode to validate credentials when present, but allow requests without credentials. This mode is useful for services that offer both authenticated and unauthenticated access.

{{< callout type="warning" >}}
The `Optional` mode allows requests without credentials. Use this mode only when you intend to allow unauthenticated access to your services.
{{< /callout >}}

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: basic-auth-optional
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: agentgateway-proxy
  traffic:
    basicAuthentication:
      mode: Optional
      users:
        - "user:\$apr1\$TYiryv0/\$8BvzLUO9IfGPGGsPnAgSu1"
EOF
```
