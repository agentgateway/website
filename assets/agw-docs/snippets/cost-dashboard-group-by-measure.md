Use the **Group by** control to break the same traffic down by:

- **Model**: which models drive spend (`gen_ai_request_model` / `gen_ai_response_model`).
- **Provider**: spend per backend, such as OpenAI, Anthropic, Google, or Bedrock (`gen_ai_provider_name`).
- **User**: per-person accounting, ideal for finding who drives spend (`agentgateway_user`).
- **Group**: spend per team or group (`agentgateway_group`).
- **User agent**: spend per client, such as Cursor, Claude Code, or `openai-python` (`user_agent_name`).

Toggle **Measure** between tokens, cost, and requests to view the same breakdown either way. Set it to **Cost** to see realized spend in dollars.
