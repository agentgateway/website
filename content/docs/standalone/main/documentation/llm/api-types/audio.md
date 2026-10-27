---
title: Audio
weight: 37
description: Send transcription, translation, and speech requests through agentgateway, and record audio usage and cost.
---

The OpenAI-compatible audio APIs transcribe audio to text, translate audio to English text, and generate speech from text.

## About

Agentgateway recognizes the following audio paths in the `llm` configuration. It reads the model from the request, routes the request to the matching model, and records the operation, usage, and cost.

| API path | `gen_ai.operation.name` | Usage and cost |
|----------|-------------------------|----------------|
| `/v1/audio/transcriptions` | `transcription` | The audio duration is read from the `usage.seconds`, `usage.prompt_audio_seconds`, or top-level `duration` field of the response. |
| `/v1/audio/translations` | `transcription` | Same as transcriptions. |
| `/v1/audio/speech` | `speech` | None. The response is binary audio with no usage fields, so the request has no usage and no cost. |

Transcription and translation requests send the audio file as multipart form data. Agentgateway reads the `model` form field, and rewrites it when the model maps to a different upstream name. The other form fields, such as the uploaded file, are forwarded unchanged.

The audio duration is available as `llm.audioSeconds` in CEL expressions and as `gen_ai.usage.audio_seconds` in access logs and traces. To price it, set a `perAudioMinute` rate in USD per minute for the model in the model cost catalog. The audio cost is the duration in minutes multiplied by the rate. The built-in catalog includes per-minute rates for some OpenAI transcription models, such as `whisper-1`. For other models, or for contracted pricing, add your own rate. For more information, see [Cost tracking]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).

## Transcribe audio and record the cost {#transcribe}

1. Create a catalog overlay that prices `whisper-1` at `$0.006` per minute of audio. The built-in catalog already prices this model. Use the same shape for a model that the built-in catalog does not price, or to set your own rate.

   ```sh
   cat <<'EOF' > audio-costs.json
   {
     "providers": {
       "openai": {
         "models": {
           "whisper-1": {
             "rates": { "perAudioMinute": "0.006" }
           }
         }
       }
     }
   }
   EOF
   ```

2. Create a configuration file with a transcription model and a speech model. The access log adds the audio duration, the audio cost, and the rate that was applied.

   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     modelCatalog:
     - file: ./audio-costs.json
   frontendPolicies:
     accessLog:
       add:
         audio_seconds: llm.audioSeconds
         audio_cost: llm.cost.audioDuration
         audio_rate: llm.costRates.perAudioMinute
   llm:
     models:
     - name: whisper-1
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
     - name: tts-1
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   EOF
   ```

3. Run agentgateway with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```console
   info	llm::catalog	model catalog loaded	...
   info	llm::catalog	watching model catalog files	count=1
   info	state_manager	loaded config from File("config.yaml")
   ```

4. In another terminal, send a transcription request with an audio file, such as `audio.mp3`.

   ```sh
   curl http://localhost:4000/v1/audio/transcriptions \
     -F model=whisper-1 \
     -F file=@audio.mp3
   ```

   Example output:

   ```json
   {"text":"Hello from agentgateway.","usage":{"type":"duration","seconds":90}}
   ```

5. Check the access log in the terminal where agentgateway runs. The entry records the `transcription` operation, the audio duration, and the cost. A duration of 90 seconds at `$0.006` per minute costs `$0.009`.

   ```console
   info	request ... http.path=/v1/audio/transcriptions http.status=200 protocol=llm gen_ai.operation.name=transcription gen_ai.provider.name=openai gen_ai.request.model=whisper-1 agw.ai.original_model=whisper-1 agw.ai.usage.cost.total=0.009 gen_ai.usage.audio_seconds=90 ... audio_seconds=90 audio_cost=0.009 audio_rate=0.006
   ```

6. Send a speech request, and save the audio to a file.

   ```sh
   curl http://localhost:4000/v1/audio/speech \
     -H "Content-Type: application/json" \
     -d '{"model": "tts-1", "input": "Hello from agentgateway.", "voice": "alloy"}' \
     --output speech.mp3
   ```

   The access log records the `speech` operation. The entry has no usage or cost fields, because the response is binary audio.

   ```console
   info	request ... http.path=/v1/audio/speech http.status=200 protocol=llm gen_ai.operation.name=speech gen_ai.provider.name=openai gen_ai.request.model=tts-1 agw.ai.original_model=tts-1 duration=1ms
   ```

To route the audio paths on a `routes` AI backend instead of `llm.models`, set each audio path to `detect` in `policies.ai.routes`. A `detect` route records the same operation, usage, and cost. A `passthrough` route records none of them. For more information about route types, see [Passthrough]({{< link-hextra path="/documentation/llm/api-types/passthrough/" >}}).
