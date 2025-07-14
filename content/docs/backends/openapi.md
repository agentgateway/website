---
title: OpenAPI
weight: 10
description: 
---

Expose an OpenAPI server on the agentgateway. 

## Configure the agentgateway

1. Download the OpenAPI schema for the Petstore app. 
   ```sh
   curl -o ./examples/openapi/openapi.json https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/openapi/openapi.json
   ```

2. Create an OpenAPI configuration for your agentgateway. In this example, the agentgateway is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Backend**: The agentgateway connects to a Swagger UI endpoint that exposes the OpenAPI spec for the Petstore sample app. You also include the OpenAPI schema that you downloaded earlier. 
   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/openapi/config.yaml" >}}
   EOF
   ```

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

<!-- TODO UI bug with Playground

## Verify access to the Petstore APIs

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

2. Connect to the OpenAPI server with the agentgateway UI playground. 
   1. Go to the agentgateway UI [**Playground**](http://localhost:15000/ui/playground/).
   2. In the **Connection Settings** card, select your **Listener Endpoint** and click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the APIs that are exposed on the target. 
   3. Verify that you see the Petstore APIs from the OpenAPI spec as a list of **Available Tools** 
   
      {{< reuse-image src="img/agentgateway-ui-tools-openapi.png" >}}

3. Verify access to the Petstore APIs. 
   1. Select the `petstore_addPet` API. 
   2. In the **body** field, enter the details for your pet, such as the ID and name for the pet category and your pet, a URL to a photo of your pet, the pet's status in the store, and optionally any tags. You can use the following example JSON file. 
      ```yaml
      {
        "id": 10,
        "category": {
          "id": 1,
          "name": "Dogs"
        },
        "name": "doggie",
        "photoUrls": [
          "https://example.com/photo1.jpg",
          "https://example.com/photo2.jpg"
        ],
        "tags": [
          {
            "id": 101,
            "name": "fluffy"
          },
          {
            "id": 102,
            "name": "friendly"
          }
        ],
        "status": "available"
      }
      ```
   3. Click **Run Tool**. Verify that the pet is added to the petstore. 
      
      {{< reuse-image src="img/agentgateway-ui-tools-openapi-success.png" >}}
      
-->