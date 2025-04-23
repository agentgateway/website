---
title: OpenAPI
weight: 10
description: 
---

Expose an OpenAPI spec on the agentproxy. 

## Configure the agentproxy

1. Download the OpenAPI schema for the Petstore app. 
   ```sh
   curl -o openapi.json https://raw.githubusercontent.com/agentproxy-dev/agentproxy/main/examples/openapi/openapi.json
   ```

2. Create a listener and target configuration for your agentproxy. In this example, the agentproxy is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Target**: The agentproxy connects to a Swagger UI endpoint that exposes the OpenAPI spec for the Petstore sample app. You also include the OpenAPI schema that you downloaded earlier. 
   ```sh
   cat <<EOF > config.json
   {
        "type": "static",
        "listeners": [
          {
            "sse": {
              "address": "[::]",
              "port": 3000
            }
          }
        ],
        "targets": {
          "mcp": [
            {
              "name": "petstore",
              "openapi": {
                "host": "petstore3.swagger.io",
                "port": 443,
                "schema": {
                  "file_path": "./openapi.json"
                }
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
   
## Verify access to the Petstore APIs

1. Run the MCP Inspector. 
   ```sh
   SERVER_PORT=9000 npx @modelcontextprotocol/inspector
   ```

2. Open the MCP inspector at the address from the output of the previous command, such as `http://localhost:5173?proxyPort=9000`.

3. Connect to the agentproxy. 
   1. Select `SSE` from the **Transport Type** drop down. 
   2. Enter `http://localhost:3000/sse` in the **URL** field. 
   3. Click **Connect** to connect to the agentproxy. 
   
4. Verify access to the Petstore APIs. 
   1. From the menu bar, select **Tools**. 
   2. Click **List Tools**. Verify that the Petstore APIs from the OpenAPI spec are displayed. 
   3. Select the `petstore_addPet` API. 
   4. Enter the details for your pet, such as the **ID** and **Name** for the pet category and your pet, a URL to a photo of your pet, the pet's **Status** in the store, and optionally any tags. Click **Run Tool**. Verify that the pet is added to the petstore. 
      
      {{< reuse-image src="img/openapi-pet-add.png" >}}
      