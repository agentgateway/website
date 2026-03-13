---
title: OpenAI moderation
weight: 15
description: Detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence with the OpenAI moderation API.
---

The OpenAI Moderation API detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Block harmful content

1. Create a configuration file and add the OpenAI moderation model that you want to use.
   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
       guardrails:
         request:
         - openAIModeration:
             model: omni-moderation-latest
             policies:
               backendAuth:
                 key: "$OPENAI_API_KEY"
           rejection:
             body: "Content blocked by moderation policy"
   EOF
   ```

2. Start the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

3. Send a request to the LLM that triggers the built-in guardrail. Verify that the request is blocked with a 403 response message. 
   ```sh
   curl -i http://localhost:4000/v1/chat/completions \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```

   Example output: 
   ```console
   HTTP/1.1 403 Forbidden
   content-length: 36

   Content blocked by moderation policy%    
   ```