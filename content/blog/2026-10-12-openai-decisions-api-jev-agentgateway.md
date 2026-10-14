---
title: "Using OpenAI's Decisions API and Jev through agentgateway"
category: "Tutorial"
publishDate: 2026-10-12
author: "Christian Posta"
description: ""
toc: true
draft: false
---

AI models exist for voice, images, and text generation (LLM, for example), but some times, applications need judgements. Let's say a customer sends this to your support application:

> "My order arrived broken. Please refund me."

Before the application generates a response, it may need to answer a much narrower question: "is this customer asking for a refund?" The application can get to helping the customer much faster if it can figure that out. It needs a bounded answer that it can use in code, such as a probability that the statement is true.

There are a lot of these decisions hiding inside applications. Which support queue should receive this request? How severe is the incident? Does the generated answer actually address the user's question?

Security fits into this "judgement" category too. An application may want to ask whether an incoming prompt is trying to override its instructions, or whether a generated response contains harmful content or appears to disclose a secret. Those decisions carry more risk than routing a support ticket, but the basic shape is the same: the model returns a signal, and the application decides what that signal means.

And that's where decision APIs come into the picture. OpenAI now has a dedicated [Decisions API](https://developers.openai.com/api/docs/guides/decisions) for checking conditions, selecting from fixed options, and scoring content against a rubric; TypeSafe's [Jev](https://docs.typesafe.ai/introduction) was an early example of a model built around typed questions and structured probabilities; and Cloudflare now has the [Clef family](https://developers.cloudflare.com/workers-ai/models/clef/) built around a similar System One contract. This is still a pretty early category, but the direction is useful: give software a bounded signal it can consume directly instead of forcing every judgment through free-form generation.

Agentgateway now supports this API shape across OpenAI and Jev, so let's look at what that actually means.

## Agentgateway now supports the Decisions API. What is that?

The [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions) is a pretty simple contract. You send some shared evidence in `input`, along with one or more typed `questions`, to `/v1/decisions`. The model performs a judgement and issues a response contains a corresponding `answers` array that application code can consume directly.

Let's use the refund example from above. The request looks like this:

```json
{
  "model": "gpt-6-luna",
  "input": "My order arrived broken. Please refund me.",
  "questions": [
    {
      "type": "predicate",
      "name": "refund_requested",
      "instructions": "Is the customer asking for a refund?"
    }
  ]
}
```

The response comes back with an answer for `refund_requested` and a probability that the predicate is true (the actual probability will depend on the model/input):

```json
{
  "model": "gpt-6-luna",
  "answers": [
    {
      "type": "predicate",
      "name": "refund_requested",
      "probability": 0.98
    }
  ]
}
```

The important part is that the API does not return a simple `true` or `false`. It returns a probability, and the application decides whether `0.98` is sufficient to route the request to a refund workflow, ask the customer another question, or send the ticket to a person. A model can also refuse a question, so the application needs an explicit path for that too.

The API currently defines three question types:

- `predicate` returns the probability that a condition is true, like whether the customer is asking for a refund.
- `choice` selects from options supplied by the application, like `billing`, `shipping`, `technical`, etc, and returns the probability distribution over those choices.
- `score` evaluates the input against ordered levels, like `low`, `medium`, and `high` severity. The returned score is a probability-weighted average and can fall between those levels, so it should not be confused with confidence.

So where does agentgateway fit? A client sends the same `/v1/decisions` request to agentgateway regardless of which supported decision model sits upstream. For OpenAI, agentgateway applies the configured model routing/aliases and upstream authentication, forwards the Decisions request, and captures the model/token usage for telemetry. For Jev, agentgateway translates the OpenAI request into Jev's `/v1/systemone` format and translates the response back into the OpenAI shape.

OpenAI represents questions as an array and calls the yes/no primitive a `predicate`; System One keys questions by name and calls the equivalent primitive a `noul`. Choices/scores and their probability distributions also have to be mapped in both directions. From the client application's point of view, however, the contract stays `/v1/decisions`, which means a virtual model can route the same request to OpenAI or Jev without changing the client code.

These model judgements can feed into guardrails, ABAC policies, or other authorization checks. The model's probability is a signal that policy can use to challenge, review, or reject a request, but it should NOT grant permissions that the caller does not already have. Agentgateway also does not automatically convert that signal into allow/deny; application code or a webhook owns the threshold, fallback, and review path. The repository has a complete [Decisions guardrail example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-guardrail-jev-openai) that evaluates traffic with OpenAI and Jev, then returns an action for agentgateway to enforce, and I'll come back to this distinction later.

## Make a Decisions call through agentgateway

At the time of writing, Decisions support is on `main` and in nightly builds (it will be in the next release). But if you're curious to try it out now, go to the [Nightly Release workflow](https://github.com/agentgateway/agentgateway/actions/workflows/nightly.yml), select a successful run from October 9, 2026 or later and copy the run ID from the URL. The [October 9 build](https://github.com/agentgateway/agentgateway/actions/runs/37940656707) is one known-good example.

On macOS, download the binary with the [GitHub CLI](https://cli.github.com/):

```sh
gh run download <RUN_ID> \
  -R agentgateway/agentgateway \
  -n release-binary-mac

chmod +x agentgateway
./agentgateway --version
```

The other artifact names are `release-binary-linux`, `release-binary-linux-arm`, and `release-binary-windows`. For Kubernetes, use `0.0.0-latest-dev` with the [agentgateway Helm installation guide](https://agentgateway.dev/docs/kubernetes/latest/documentation/install/helm/) and keep the CRDs/controller on the same build. That version is mutable, so use it for evaluation rather than a pinned production deployment.

Now save the following as `decisions.yaml`. Both models expose `/v1/decisions` to the client; agentgateway translates the request when `jev-latest` is selected.

```yaml
gateways:
  default:
    port: 4000
llm:
  models:
  - name: gpt-6-luna
    provider: openai
    params:
      apiKey: $OPENAI_API_KEY
  - name: jev-latest
    provider: typesafe
    params:
      apiKey: $TYPESAFE_API_KEY
```

Export the provider keys and start agentgateway:

```sh
export OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
export TYPESAFE_API_KEY=<YOUR_TYPESAFE_API_KEY>
./agentgateway -f decisions.yaml
```

Send the same refund question from the previous section to OpenAI through agentgateway:

```sh
curl http://localhost:4000/v1/decisions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-6-luna",
    "input": "My order arrived broken. Please refund me.",
    "questions": [{
      "type": "predicate",
      "name": "refund_requested",
      "instructions": "Is the customer asking for a refund?"
    }]
  }'
```

Change `model` to `jev-latest` and send it again. The client still receives the OpenAI Decisions response shape, while agentgateway sends the request upstream using Jev's `/v1/systemone` API and supplies the configured provider key.

## A decision is a signal, not authorization

So can one of these model judgements participate in an authorization decision? It can, but only as an input to policy. A high-risk score might cause a request to be rejected, challenged, or sent for human approval, but it should never grant authority that identity, delegation, and the application's baseline policy did not already permit.

Take a `choice` question that asks a model to select `read`, `update`, or `delete`. The application should only give the model choices that the caller may perform in the current context, and the API that eventually executes the operation must check the caller's permission, the current resource state, and any preconditions again. A model returning `read` does not authorize a later `DELETE`, and a model returning `delete` cannot expand a read-only token.

A few rules I would use before putting one of these signals into a consequential path:

- Treat probabilities as estimates. Set thresholds using representative data and the actual cost of false positives and false negatives, and send refusals or uncertain results to a safe fallback, no-op, or review path.
- Keep untrusted content such as user input, retrieved documents, and tool output separate from trusted policy state. Cleaning up a prompt is not an authorization control, and approval for a destructive action should come through a separate trusted channel.
- Layer the model judgement with deterministic authorization, least privilege, input validation, egress controls, secret scanning, and rate limits.
- Record enough context to explain what happened: the question version, model, available options, returned probabilities, policy outcome, and a privacy-conscious reference to the input. Then test the complete path with adversarial content, not only the classifier in isolation.

In practice, the model evaluates ambiguous input, application policy decides what the signal means, the resource API verifies whether the operation is actually allowed, and agentgateway routes the evaluation and can enforce the result of a policy webhook. Decision models can add scrutiny or narrow the actions under consideration, but they should never manufacture permission.

## Try it out

Decisions support is available in agentgateway [nightly builds](https://github.com/agentgateway/agentgateway/actions/workflows/nightly.yml) today, so grab a build and try the same question against OpenAI and Jev. If you are working on a guardrail use case, start with the [`llm-guardrail-jev-openai` example](https://github.com/agentgateway/agentgateway/tree/main/examples/llm-guardrail-jev-openai), and let us know what you find.
