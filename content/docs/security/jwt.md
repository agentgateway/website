---
title: Authenticate and authorize requests
weight: 20
description: 
---

Use a JWT token to authenticate requests before forwarding them to a target. 

## Before you begin

{{< reuse "docs/snippets/prereq-agentgateway.md" >}}

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
                  - "*"
            backends:
      ...
      ```

4. Save the public key of the JWKS that the policy refers to in the corresponding directory, such as the following example with `manifests/jwt`.
   
   ```sh
   mkdir -p manifests/jwt
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/pub-key -o manifests/jwt/pub-key
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

5. Verify that you get access to more tools by providing a JWT with no claims.

   1. In a new browser tab, copy the JWT from the [`example2.key`](https://github.com/agentgateway/agentgateway/blob/main/manifests/jwt/example2.key) file. This JWT is for the `test-user` and has no claims. To review the JWT details, you can use a tool like [jwt.io](https://jwt.io/).

   2. In the Playground UI, copy the JWT into the **Bearer Token** field and click **Connect**.

   3. Verify that you now have access to two tools as allowed in the JWT policy: `echo` and `add`. This user does not have access to the `printEnv` tool because the JWT does not have a matching claim.
   
      {{< reuse-image src="img/ui-jwt-test-user.png" >}}

6. Verify that you get access to even more tools with a JWT that has a matching claim.

   1. In a new browser tab, copy the JWT from the [`example1.key`](https://github.com/agentgateway/agentgateway/blob/main/manifests/jwt/example1.key) file. This JWT is for the `test-user` and has a matching claim. To review the JWT details, you can use a tool like [jwt.io](https://jwt.io/).

   2. In the Playground UI, click **Disconnect** to end your previous session with the `example2` JWT.
   
   3. Copy the `example1` JWT into the **Bearer Token** field and click **Connect**.

   4. Verify that you now have access to the tools as allowed in the JWT policy: `echo`, `add`, and `printEnv`.
   
      {{< reuse-image src="img/ui-jwt-test-user-claims.png" >}}
