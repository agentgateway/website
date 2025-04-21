---
title: Control access to tools
weight: 30
description:
---

Configure the agentproxy to require a JWT token to authenticate requests and use an RBAC policy to authorize access to tools for JWT tokens that contain specific claims. 


## Configure the agentproxy

1. Download a sample, local JWT public key file. You use this file to validate JWTs later. 
   ```sh
   curl -o pub-key https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/manifests/jwt/pub-key
   ```

2. Create a configuration file for your agentproxy. In this example, you configure the following elements: 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header. You use the local JWT public key file to validate the JWT. Only JWTs that include the `sub: me` claim can authenticate with the agentproxy successfully. If the request has a JWT that does not include this claim, the request is denied.
   * **RBAC policy**: An RBAC policy that allows access to the `everything_echo` tool when a JWT token with the `sub: me` claim is present in the request. 
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. 
   
   ```sh
   cat <<EOF > ./config.json
   {
     "type": "static",
     "listeners": [
       {
         "name": "sse",
         "sse": {
           "address": "[::]",
           "port": 3000,
           "authn": {
             "jwt": {
               "issuer": [
                 "me"
               ],
               "audience": [
                 "me.com"
               ],
               "local_jwks": {
                 "file_path": "./pub-key"
               }
             }
           },
           "rbac": [
             {
               "name": "default",
               "rules": [
                 {
                   "key": "sub",
                   "value": "me",
                   "resource": {
                     "type": "TOOL",
                     "target": "everything",
                     "id": "echo"
                   },
                   "matcher": "EQUALS"
                 }
               ]
             }
           ]
         }
       }
     ],
     "targets": {
       "mcp": [
         {
           "name": "everything",
           "stdio": {
             "cmd": "npx",
             "args": [
               "@modelcontextprotocol/server-everything"
             ]
           }
         }
       ]
     }
   }
   EOF
   ```

3. Run the agentproxy. 
   ```sh
   agentproxy -f ./config.json
   ```
   
## Verify access to tools

1. Open the MCP Inspector. 
   ```sh
   SERVER_PORT=9000 npx @modelcontextprotocol/inspector
   ```

2. Open the MCP inspector at the address from the output of the previous command, such as `http://localhost:5173?proxyPort=9000`.

3. Connect to the agentproxy. 
   1. Select `SSE` from the **Transport Type** drop down. 
   2. Enter `http://localhost:3000/sse` in the **URL** field. 
   3. Expand the **Authentication** drop down and enter the following JWT token in the **Bearer Token** field. The JWT token includes the `sub: me` claim that is allowed access to the `everything_echo` tool. 
      ```sh
      eyJhbGciOiJFUzI1NiIsImtpZCI6IlhoTzA2eDhKaldIMXd3a1dreWVFVXhzb29HRVdvRWRpZEVwd3lkX2htdUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJtZS5jb20iLCJleHAiOjE5MDA2NTAyOTQsImlhdCI6MTc0Mjg2OTUxNywiaXNzIjoibWUiLCJqdGkiOiI3MDViYjM4MTNjN2Q3NDhlYjAyNzc5MjViZGExMjJhZmY5ZDBmYzE1MDNiOGY3YzFmY2I1NDc3MmRiZThkM2ZhIiwibmJmIjoxNzQyODY5NTE3LCJzdWIiOiJtZSJ9.cLeIaiWWMNuNlY92RiCV3k7mScNEvcVCY0WbfNWIvRFMOn_I3v-oqFhRDKapooJZLWeiNldOb8-PL4DIrBqmIQ
      ```
   4. Click **Connect** to connect to the agentproxy. 

3. Try out access to the tools. 
   1. From the menu bar, select **Tools**. 
   2. Click **List Tools**. 
   3. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
      {{< reuse-image src="img/mcp-access-granted.png" >}}
   4. Select a different tool, such as `everything_add`, enter any number in the **a** and **b** fields, and click **Run Tool**. Verify that access to the tool is denied, because the RBAC policy only allowed access to the `everything_echo` tool. 
      {{< reuse-image src="img/mcp-access-denied.png" >}}
   