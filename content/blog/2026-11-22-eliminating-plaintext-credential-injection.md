---
title: "Credential Injection Patterns for AI Agents: Part 4, Eliminating Plaintext"
category: "Deep Dive"
publishDate: 2026-11-22
author: "Christian Posta"
description: "The gateway in a credential brokering setup sees the same bearer tokens any intercepting egress proxy already sees. The controller didn't need to see them too, so let the gateway do the final unwrap, and then look at what it would take to close the one gap brokering adds at the gateway."
toc: false
---

{{< reuse-image src="img/blog/cb4a/cb4a-part2.gif" alt="CB4A Flow" >}}

This is the last part in the [Credential Injection Patterns for AI Agents series](/blog/2026-07-27-credential-injection-ai-agent-egress-cb4a/). The series reviewed patterns for securing the credentials used by AI agents with the premise that: you can't trust what an AI agent will do with credentials you give to it. They WILL eventually leak. Littering API keys/OAuth tokens/client secrets all over your AI agents creates a governance nightmare, with no way to expire/revoke/audit/control. If we adopted a credential brokering pattern, we can alleviate this pain but introduce a new potential issue. What happens to the token vault if the process that reads it is compromised?

Links to the previous posts:

- Part 2: [Securing the Vault with AWS KMS](/blog/2026-08-03-protecting-token-vault-kms-credential-injection/)
- Part 2.5: [Picking up where KMS grants stop Scaling](/blog/2026-10-20-credential-brokering-mode-3-at-scale/)
- Part 3: [Protecting the token vault with OpenBAO and Vault](/blog/2026-11-02-protecting-token-vault-openbao-credential-injection/)

The responses for each of these posts have been absolutely incredible, with a number of them [going viral](https://www.linkedin.com/posts/ceposta_you-should-not-give-ai-agents-any-share-7518426181592113152-rEot/)! Both [part 2.5](/blog/2026-10-20-credential-brokering-mode-3-at-scale/) and [part 3](/blog/2026-11-02-protecting-token-vault-openbao-credential-injection/) reactions got some version of "you didn't remove the risk! you just moved it to the gateway" [on LinkedIn](https://lnkd.in/p/ggyMGWn5). In the [part 3 thread](https://www.linkedin.com/feed/update/urn:li:activity:7523131357552762882/) someone pointed out that a compromised gateway can just log credentials after each authorized use, it only takes longer. That's all true, and it's the dwell/trickle blast radius I mentioned at the end of part 3. But the gateway was always going to see those tokens. So we didn't actually "move the risk to the gateway". It was already there.

The gateway terminates the agent's MCP/API/LLM connection and puts the upstream token on the wire (the agent never holds one, which was the whole point of [part 1](/blog/2026-07-27-credential-injection-ai-agent-egress-cb4a/)), so it sees plaintext on every live request. So does every TLS-intercepting egress proxy you already run (Zscaler, Netskope, Squid with bumping, etc), for every script, CI job, and SaaS integration, not just agents. 

So what did brokering add? It put every user's upstream tokens in one logical store. And then we discussed how to prevent the component with access to the store from total melt down if compromised. But we ended up with some "control plane" component still seeing plaintext credentials at some point in time. And this motivates part 4: Why should we have another component get exposed to plaintext beside the gateway when doing the injection?

In this post I want to move the final unwrap to the gateway, so the controller only ever holds ciphertext and the gateway is exactly as exposed as it already was. Then I'll look at where this could go next to make the gateway unwrap safer including attaching the credential inside a trusted execution environment (TEE) so the gateway never sees it. Let's get into it!

## Why does the controller see plaintext at all?

In the 2.5 post, the controller sends the subject token, a freshness proof, and the row's wrapped DEK to the broker, gets the plaintext DEK back, opens the inner AES-GCM layer, and hands the upstream token to the gateway. It does all of that because it's the STS, and the [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693) token exchange contract is subject token in, upstream token out. That's a perfectly reasonable API, but it means the controller passes the plaintext token back to the gateway. The controller needs to find the right row, but does it really need to open it?

What if we want ONLY the gateway to see the plaintext? If we change the API, the gateway gets the ciphertext from the controller, the plaintext DEK from the broker, and only it can decrypt. The gateway was going to hold the plaintext token a few milliseconds later anyway, so the only thing that changes on the gateway is where the AES-GCM decrypt happens. The controller becomes just a store and a state machine (elicitation state, row metadata, expiry) with no decrypt path and no plaintext credential. 

{{< reuse-image src="img/blog/cb4a/part4-two-halves.png" alt="Part 2.5 vs part 4: which component opens the row" >}}


The controller loses encrypt permission too, which it can only do if we adopt the "refresher" component from 2.5. That refresher component became the OAuth client that completes the code exchange and wraps the rows it writes, so with the read path moved to the gateway there's nothing left for the controller to call KMS or Transit for.

## The flow

{{< reuse-image src="img/blog/cb4a/part4-flow.png" alt="The flow: the gateway gets the ciphertext from the controller and the DEK from the broker" >}}


The broker only accepts the gateway's SVID, so a compromised controller can't ask for an unwrap at all, no matter how many subject tokens it has harvested. In parts 2 and 3 the gateway-signed freshness proof did that job. The broker still verifies the subject token against the IdP JWKS on every unwrap, which limits the gateway to users who are actually active. The controller only releases ciphertext to the gateway for the row's owner, so nobody else can bulk-pull the store.

The grant-shaped versions work the same way with a different party calling `Decrypt`. On KMS, the broker mints a [grant](https://docs.aws.amazon.com/kms/latest/developerguide/grants.html) with the gateway's role as grantee instead of the controller's. In Mode 3b on OpenBao, the broker mints the batch token with `token_bound_cidrs` set to the gateway's pod CIDR, and the gateway calls `transit/decrypt` itself. Part 3's vault-login design is the smallest change of all, since the gateway already logs in as the user and holds the OpenBao token, so it would call Transit directly instead of handing the token to the controller. That takes the controller out, and the gateway ends up where it is in the other designs, since a live request already opened all of that user's rows. 

## What does the gateway get to decrypt?

Only the access token. In the store from part 2, each row's payload is the whole token response (access token, refresh token, id token) under one DEK, which is fine when the controller opens it and only hands the access token on. If the gateway opened that same row it would get the refresh token too, so the refresh token has to live under its own DEK (in the refresher's store from 2.5) that the gateway never gets. When an access token expires, the refresher writes a new wrapped access-token row and the gateway unwraps it like any other, so neither the gateway nor the controller ever sees a refresh token.

## What does a compromised gateway get?

*"So now the most exposed component on the network does all of the decrypting. How is that better?"*

The gateway already held the plaintext for every in-use token, in every mode, because it's the thing putting the token on the wire. What this change does is stop a second component from holding it too. An attacker who sits on the gateway harvests in-use tokens at the rate of use whether or not the gateway does the AES-GCM open, and that was true in part 2. An attacker who sits on the controller, which in 2.5 harvested exactly the same tokens, now gets ciphertext.

For tokens in flight, a compromised brokering gateway sees exactly what a compromised intercepting proxy would. The one thing it can do that a proxy can't is *ask* for credentials. With alice's live subject token it can call the broker for her Slack and Jira rows even if her agents only touched GitHub that day, because the gateway is the one naming the `resource` (a confused deputy). That works for as long as her subject token is valid (typically about an hour after her last request), and it's capped at the rows of users who are active during the compromise. Nothing works offline, dormant users are out of reach, and every pull shows up in the broker's decision log. Part 3's comparison table says the same for both OpenBao designs, so moving the unwrap doesn't change it.

{{< reuse-image src="img/blog/cb4a/part4-compromised-gateway.png" alt="What a compromised gateway reaches" >}}

The trickle doesn't stop when you evict the attacker, either. The gateway collects at the rate of use while the attacker sits on it, but whatever it logged stays usable until the upstream expires it, so the lifetime of the upstream access tokens is part of the gateway's blast radius, and that varies a lot by provider (some issue tokens that don't expire unless you turn expiration on).

Here's what each single compromise gets you after the change.

- **Controller:** ciphertext only, never plaintext, never a DEK. It can serve a stale row for the same user and resource, or refuse to serve anything (DoS). The two attacks from 2.5 (sitting on the hot path, and seeing plaintext at creation) are both gone.
- **Gateway:** plaintext for in-use tokens, same as any intercepting proxy, plus the active users' other rows described above. Same as every earlier design.
- **Broker:** standing decrypt and the wrapped DEKs it sees on live requests, but never a payload, so on its own it reads nothing. Paired with the controller (or any other path to the DB) it reads the whole store, which makes it the high-value target. Same as 2.5, and broker-to-DB isolation is still what stops it from using that decrypt on the store, so lock that path down and keep the broker and the controller in separate trust domains (separate identities, separate network paths to the DB and to KMS/OpenBao) so one compromise doesn't hand over both.
- **Refresher:** unchanged from 2.5, roughly Mode 2 posture for refresh tokens, which is why it gets the tightest network policy in the system.

The one thing a ciphertext-only controller can still do is let an attacker steal ciphertext now and hope to get the KEK later (root on the OpenBao node, a key policy mistake during a migration, etc). On OpenBao the answer is to [`rewrap`](https://openbao.org/api-docs/secret/transit/) on a schedule and then raise `min_decryption_version` on the Transit key, so ciphertext stolen before the rewrap goes stale. Rewrap on its own doesn't help, since the old key version still decrypts whatever the attacker took.

## Where could this go?

Everything above leaves the gateway with the same two problems every earlier design had. The plaintext token is in the gateway, since it's the thing putting the token on the wire, so whatever a compromised gateway logs/captures keeps working after you evict it. And the gateway decides which credential to fetch, so with a live subject token it can ask for an active user's other rows. An agent-signed proof takes that choice away from the gateway, and a TEE takes the plaintext off the gateway host.

### The gateway picks the credential

To take that choice away from the gateway, the agent has to sign a proof bound to what it's trying to reach, which the gateway can carry to the broker but can't make on its own. The IETF WIMSE working group has two drafts that do this, a Workload Proof Token and an HTTP Message Signatures profile.

The agent holds a Workload Identity Token (WIT) from [SPIRE](https://spiffe.io/docs/latest/spire-about/) or equivalent, with its public key in `cnf`. With the [Workload Proof Token](https://datatracker.ietf.org/doc/draft-ietf-wimse-wpt/) (WPT), it signs a short-lived JWT with that key on every request, with the request's target URI as the `aud`.

```json
{
  "aud": "https://agw.internal/mcp/github",
  "exp": 1793260830,
  "jti": "7f3a9c1e-2b8d-4c51-9e0a-6d4f1b2a8c33",
  "wth": "<hash of the agent's WIT>",
  "oth": { "<header carrying alice's subject token>": "<hash of it>" }
}
```

The gateway forwards the WIT, the WPT, and the subject token to the broker on its own mTLS connection, along with the wrapped DEK. The broker verifies the WIT against the SPIRE trust bundle and checks that its SPIFFE ID is an agent workload (otherwise the gateway could just sign its own proof with its own SVID), then verifies the WPT, checks the subject token hash, consumes the `jti`, maps `/mcp/github` to `https://api.github.com`, and only unwraps that row. So one proof buys one unwrap, of the token the gateway was going to put on the wire anyway. The check has to be at the broker, since the controller only ever hands out ciphertext and the broker is the one releasing the key. The row context is bound to the wrapped DEK, so the broker can confirm which row it's unwrapping instead of taking the controller's or the gateway's word for it.

{{< reuse-image src="img/blog/cb4a/part4-wimse-proof.png" alt="The broker only unwraps the row the agent signed for" >}}

That works when each upstream has its own path. A virtual MCP server in agentgateway puts several upstreams (e.g. GitHub and Slack) behind one endpoint, so the `aud` is the same for all of them and a compromised gateway could still ask for any of those rows. Since [SEP-2243](https://modelcontextprotocol.io/seps/2243-http-standardization), MCP clients send the name of the tool they're calling in an `Mcp-Name` header (e.g. `create_issue`), so the agent can sign that too, either as an extra WPT claim or as a covered component in the WIMSE [HTTP Message Signatures profile](https://datatracker.ietf.org/doc/draft-ietf-wimse-http-signature/). The broker then maps the tool to the upstream instead of the path.

Either way, the broker needs its own copy of the path / tool name to upstream mapping or a compromised gateway just tells it `create_issue` means Slack. 

With that in place, a compromised gateway only gets the tokens agents actually asked for while they're asking, same as any intercepting proxy. It does nothing for the plaintext, though. The cost is that every agent signs every request, which is a small SDK change for runtimes you control (your own platform, [kagent](https://kagent.dev), etc) and something Claude Desktop, Cursor, VS Code, etc need extension points for.

### The plaintext is on the gateway

For this one, I'd look at moving the step that attaches the token into a small injector running inside a trusted execution environment (TEE). That's a hardware-isolated enclave (e.g. [Intel TDX](https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html), [AMD SEV-SNP](https://www.amd.com/en/developer/sev.html), [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/)) whose memory the host OS, the hypervisor, and root on the machine can't read. The hardware can also attest to exactly what code is running in it, which is how the broker would know it's releasing the DEK to the injector rather than the gateway. If the DEK fetch, the AES-GCM open, attaching the header, and the TLS session to the upstream all happen in there, the plaintext token never exists on the gateway host. A compromised gateway can still push requests through the enclave as alice while she's active, but it walks away with nothing, so the trickle stops when you evict it. The gateway still picks the row, though, so this pairs with the WIMSE proof rather than replacing it.

{{< reuse-image src="img/blog/cb4a/part4-dwell-timeline.png" alt="How long a gateway compromise lasts, with and without a TEE" >}}

TEEs have historically been pretty constrained in runtime, networking, and integrations, but on AWS at least the pieces are there. KMS can return the DEK encrypted to the enclave's attested key (the [`Recipient`](https://docs.aws.amazon.com/kms/latest/developerguide/attested-calls.html) parameter on `Decrypt`), and the broker could make that call on the enclave's behalf without ever seeing the DEK itself. The enclave has no network of its own, so agentgateway on the host relays the bytes for it, but it's the enclave's TLS session to the upstream, so the gateway only sees ciphertext on that leg. That also means the enclave has to check the upstream's cert against roots baked into its image, for the hostname bound to the row, or a compromised gateway could just point it at a server it controls. OpenBao Transit has nothing like `Recipient`, so on the part 3 design the broker would have to verify the attestation itself. That's the approach we're taking with [Agentgateway Enterprise](https://www.solo.io/products/agentgateway-enterprise).

## Wrapping Up

The gateway in a credential brokering setup sees the same bearer tokens your intercepting egress proxy already sees even if not doing credential brokering. So what brokering really added was the store, and the controller sitting next to it on the hot path. Once the refresh tokens live in the refresher, have the gateway fetch the ciphertext from the controller and the DEK from the broker, let only the gateway call the broker, and take every KMS and Transit permission away from the controller. A compromised controller then reads nothing, and a compromised gateway gets what it always got.

That leaves the two things every design so far has had, the plaintext on the gateway and the gateway choosing which row to fetch. An agent-signed WIMSE proof bound to the path or the `Mcp-Name` the agent is calling takes the choice away from the gateway, and a small attested injector in a TEE would take the plaintext off the gateway host, so a compromised gateway could use tokens while it's in but not take any with it. I think both are worth watching.

Someone on LinkedIn suggested splitting a thin egress proxy from a separate minting tier, borrowing from payment infrastructure, which is close to where this ends up. If you have suggestions, or you're already doing something like it in your own agent platform, [connect on LinkedIn](https://linkedin.com/in/ceposta) and I'd love to hear it!!