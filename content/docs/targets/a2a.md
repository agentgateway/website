---
title: A2A
weight: 10
description: 
---

Proxy requests to an agent that communicates via the agent-to-agent protocol (A2A). 

## About A2A

Agent-to-agent, or [A2A](https://github.com/google/A2A), is an open protocol that enables communication and interoperability between opaque agentic applications. Developed by Google, A2A defines a common language that enables agents to show their capabilities and help them negotiate how they interact with the user, such as via text, forms, or bidirectional audio or video, irrespective of the framework or vendor they are built on. 

## Set up an ADK agent

Follow the [A2A sample documentation](https://github.com/google/A2A/tree/main/samples/python/agents/google_adk) to create an agent that handles reimbursements. The agent listens on port 10002. To create a Google API key, go to the [Google AI Studio](https://aistudio.google.com/app/apikey).

Example output: 
```
uv run .         
Using CPython 3.13.3
Creating virtual environment at: /Users/nadinespies/Downloads/A2A/samples/python/.venv
      Built a2a-samples @ file:///Users/nadinespies/Downloads/A2A/samples/python
      Built a2a-sample-agent-adk @ file:///Users/nadinespies/Downloads/A2A/samples/python/agents/google_adk
Installed 81 packages in 191ms
INFO:     Started server process [19274]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://localhost:10002 (Press CTRL+C to quit)
```

## Set up the Agent Gateway

Create an Agent Gateway that proxies requests to the reimbursement agent that you created earlier. 

1. Create a listener and target configuration for your Agent Gateway. In this example, the Agent Gateway is configured as follows: 
   * **Listener**: An SSE listener is configured for the A2A protocol and exposed on port 3000.  
   * **Target**: The Agent Gateway targets the reimbursement agent that you created earlier and exposed on localhost, port 10002. 
   ```sh
   cat <<EOF > config.json
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/a2a/config.json" >}}
   EOF
   ```

3. Create the Agent Gateway. 
   ```sh
   agentgateway -f config.json
   ```


## Send a request to the agent

Use the A2A CLI to send a request to your agent through the Agent Gateway. 

1. Clone the [A2A CLI](https://github.com/google/A2A/tree/main/samples/python/hosts/cli) repository and navigate to the `samples/python/hosts/cli` directory. 

2. Use the A2A CLI to connect to the agent through your Agent Gateway. 
   ```sh
   uv run . --agent http://localhost:3000/google-adk 
   ```
   
   Example output: 
   ```
   ======= Agent Card ========
   {"name":"Reimbursement Agent","description":"This agent handles the reimbursement process for the employees given the amount and purpose of the reimbursement.","url":"http://localhost:3000/google_adk","version":"1.0.0","capabilities":{"streaming":true,"pushNotifications":false,"stateTransitionHistory":false},"defaultInputModes":["text","text/plain"],"defaultOutputModes":["text","text/plain"],"skills":[{"id":"process_reimbursement","name":"Process Reimbursement Tool","description":"Helps with the reimbursement process for users given the amount and purpose of the reimbursement.","tags":["reimbursement"],"examples":["Can you reimburse me $20 for my lunch with the clients?"]}]}
   =========  starting a new task ======== 

   What do you want to send to the agent? (:q or quit to exit):
   ```

3. Enter a prompt, such as the following. 
   ```sh
   Can you reimburse me for my trip to Kubecon on 4/2/25, amount: $1000.
   ```
   
4. Optionally upload a receipt from your trip or skip this step by hitting the return key.
5. Review the logs of your agent and verify that you see the reimbursement form filled out with the information that you entered in your prompt. 
  
   ```
   -----------------------------------------------------------
   Function calls:
   name: return_form, args: {'form_request': '{"amount": "$1000", "date": "4/2/25", "purpose": "Kubecon trip", "request_id": "request_id_2241162"}'}
   -----------------------------------------------------------
   Raw response:
   {"candidates":[{"content":{"parts":[{"function_call":{"args":{"form_request":"{\"amount\": \"$1000\", \"date\": \"4/2/25\", \"purpose\": \"Kubecon trip\", \"request_id\": \"request_id_2241162\"}"},"name":"return_form"}}],"role":"model"},"finish_reason":"STOP","avg_logprobs":-0.017740900699908916}],"model_version":"gemini-2.0-flash-001","usage_metadata":{"candidates_token_count":52,"candidates_tokens_details":[{"modality":"TEXT","token_count":52}],"prompt_token_count":628,"prompt_tokens_details":[{"modality":"TEXT","token_count":628}],"total_token_count":680},"automatic_function_calling_history":[]}
   -----------------------------------------------------------
   ```