---
title: Authenticate requests
weight: 20
description: 
---

Use a JWT token to authenticate requests before forwarding them to a target. 

1. Download a sample, local JWT public key file. You use this file to validate JWTs later. 
   ```sh
   curl -o pub-key https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/manifests/jwt/pub-key
   ```

2. Create a configuration file for your agentproxy. In this example, you configure the following elements: 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header. You use the local JWT public key file to validate the JWT. Only JWTs that include the `sub: me` claim can authenticate with the agentproxy successfully. If the request has a JWT that does not include this claim, the request is denied.
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. 
   ```yaml
   cat <<EOF > ./config.json
   {
     "type": "static",
     "listeners": [
       {
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
           }
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
   agentproxy -f config.json
   ```
   
4. Send a request to the agentproxy. Verify that this request is denied and that you see a message stating that an Authorization header is required. 
   ```sh
   curl -vik localhost:3000/sse
   ```
   
   Example output:
   ```
   ...
   < HTTP/1.1 400 Bad Request
   HTTP/1.1 400 Bad Request
   ...
   {"error":"No auth header present, error: Header of type `authorization` was missing"}%   
   ```
   
5. Send another request to the agentproxy. This time, you provide a JWT in the `Authorization` header. Because this JWT includes the `sub: me` claim, the request is successfully authenticated. 
   ```sh
   curl -vik localhost:3000/sse \
   -H "Authorization: bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IlhoTzA2eDhKaldIMXd3a1dreWVFVXhzb29HRVdvRWRpZEVwd3lkX2htdUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJtZS5jb20iLCJleHAiOjE5MDA2NTAyOTQsImlhdCI6MTc0Mjg2OTUxNywiaXNzIjoibWUiLCJqdGkiOiI3MDViYjM4MTNjN2Q3NDhlYjAyNzc5MjViZGExMjJhZmY5ZDBmYzE1MDNiOGY3YzFmY2I1NDc3MmRiZThkM2ZhIiwibmJmIjoxNzQyODY5NTE3LCJzdWIiOiJtZSJ9.cLeIaiWWMNuNlY92RiCV3k7mScNEvcVCY0WbfNWIvRFMOn_I3v-oqFhRDKapooJZLWeiNldOb8-PL4DIrBqmIQ" 
   ```
   
   Example output: 
   ```
   < HTTP/1.1 200 OK
   HTTP/1.1 200 OK
   ...
   ```