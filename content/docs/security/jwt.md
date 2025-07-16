---
title: Authenticate and authorize requests
weight: 20
description: 
---

Use a JWT token to authenticate requests before forwarding them to a target. 

## Configure JWT and MCP auth policies {#jwt-mcp-auth}

1. Download a configuration file for your agentgateway.

   ```sh
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/authorization/config.yaml -o config.yaml
   ```

2. Review the configuration file.
   * **Listener**: An HTTP listener that listens for incoming traffic on port 3000. 
   * **Route policies**: The listener includes route policies for `jwtAuth` and `mcpAuthorization`. 
   * **jwtAuth**: The `jwtAuth` policy configures how to authenticate clients. The example uses sample JWT keys and tokens for demo purposes only. Requests must have a valid JWT that matches the criteria, or are denied.
   * **mcpAuthorization**: The `mcpAuthorization` policy configures who is allowed to access certain resources. These authorization rules use the [CEL Policy language](https://cel.dev/). The example lets anyone call the `echo` tool, only the `test-user` call the `add` tool, and only users with a certain claim call the `printEnv` tool.
   
   ```yaml
   cat config.yaml
   ```
   
   {{% github-yaml url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/authorization/config.yaml" %}}

3. Optional: To use the agentgateway UI playground later, add the following CORS policy to your `config.yaml` file. The config automatically reloads when you save the file.
      
      ```yaml
      binds:
      - post: 3000
        listeners:
        - routes:
          - policies:
              cors:
                allowOrigins:
                  - "*"
                allowHeaders:
                  - mcp-protocol-version
                  - content-type
            backends:
      ...
      ```

4. Save the public key of the JWKS that the policy refers to in a directory relative to where you downloaded the agentgateway binary file. Alternatively, you can run the `agentgateway` binary command from a clone of the [agentgateway repository](https://github.com/agentgateway/agentgateway).
   
   If you installed the binary at `/usr/local/bin/agentgateway`, run the following command:

   ```sh
   mkdir -p /usr/local/bin/manifests/jwt
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/pub-key -o /usr/local/bin/manifests/jwt/pub-key
   ```

5. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```
   
## Verify authentication {#verify}

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

2. From the navigation menu, click [**Playground**](http://localhost:15000/ui/playground/).
      
      {{< reuse-image src="img/agentgateway-ui-playground.png" >}}

3. In the **Testing** card, review your **Connection** details and click **Connect**. The agentgateway UI connects to the targets that you configured and retrieves the tools that are exposed on the targets. 
   
4. Verify that you see only the `echo` tool in the **Available Tools** list. Your JWT policy allows anyone to call the `echo` tool.
   
   {{< reuse-image src="img/ui-jwt-echo-tool.png" >}}

<!-- TODO JWT token steps when UI supports it

1. In the output of your running agentgateway, find and save the `session_id` as an environment variable.

   ```sh
   export SESSION_ID=<session_id>
   ```

2. Send a request to the agentgateway. Verify that this request is denied with a 401 HTTP response code and that you see a message stating that an `authorization` header is missing in the request. 
   ```sh
   curl -vik localhost:3000/mcp \
   -H "Accept: text/event-stream" \
   -H "Session-ID: $SESSION_ID"
   ```
   
   Example output:
   ```
   ...
   < HTTP/1.1 401 Unauthorized
   HTTP/1.1 401 Unauthorized
   ...
   ```

3. Save a JWT from the `example2.key` file as an environment variable. This JWT is for the `test-user` and has no claims.

   ```sh
   export JWT_TOKEN2={{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/example1.key" >}}
   ```

4. Send another request to the agentgateway. This time, you provide a JWT in the `Authorization` header. Because this JWT meets the criteria, the request is successfully authenticated and you get back a 200 HTTP response code. This user has access to the `echo` and `add` tools, but not the `printEnv` tool.
   ```sh
   curl -vik localhost:3000/mcp -H "Accept: text/event-stream" \
   -H "Session-ID: $SESSION_ID" \
   -H "Authorization: bearer $JWT_TOKEN2" 
   ```
   
   Example output: 
   ```
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...

5. Save another JWT from the `example1.key` file as an environment variable. This JWT is for the `test-user` and has a matching claim for the `printEnv` tool.

   ```sh
   export JWT_TOKEN1={{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/example1.key" >}}
   ```

6. Send another request to the agentgateway. This time, you provide a JWT in the `Authorization` header. Because this JWT meets the criteria, the request is successfully authenticated and you get back a 200 HTTP response code. This user has access to the `echo`, `add`, and `printEnv` tools.
   ```sh
   curl -vik localhost:3000/mcp -H "Accept: text/event-stream" \
   -H "Authorization: bearer $JWT_TOKEN1" 
   ```
   
   Example output: 
   ```
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...
   ```

-->