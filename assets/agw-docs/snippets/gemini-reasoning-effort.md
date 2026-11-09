## Reasoning effort {#reasoning-effort}

Set `reasoning_effort` in OpenAI-compatible Chat Completions requests to a Gemini model to configure Gemini thinking. For Gemini 2.5 and older models, `reasoning_effort` maps to `thinkingConfig.thinkingBudget`. For Gemini 3 and Gemini 4 models, `reasoning_effort` maps to `thinkingConfig.thinkingLevel`.

| Model family | `reasoning_effort` behavior |
|--------------|-----------------------------|
| Gemini 2.5 and older | `minimal`, `low`, `medium`, `high`, `xhigh`, and `max` use `thinkingBudget` values. `none` omits `thinkingConfig`. |
| Gemini 3 | `minimal`, `low`, `medium`, `high`, `xhigh`, and `max` use `thinkingLevel`. `none` omits `thinkingConfig`. |
| Gemini 4 | `minimal` and `low` use `thinkingLevel: "low"`. `medium` uses `thinkingLevel: "medium"`. `high`, `xhigh`, and `max` use `thinkingLevel: "high"`. `none` omits `thinkingConfig`. |
