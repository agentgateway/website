---
title: "Credential Injection Patterns for AI Agents: Part 2.5, Where KMS Grants Stop Scaling"
category: "Deep Dive"
publishDate: 2026-10-20
author: "Christian Posta"
description: "Mode 3 from part 2 takes standing decrypt away from the token vault with KMS grants. The grant quota caps the whole system at 50 exchanges a second, and the attacker who actually shows up doesn't need to decrypt the store anyway. Here's the variant that scales, and the component that makes what leaks worth less."
toc: false
---

We've been digging into credential shielding/brokering for AI agents in the egress/outbound direction. In [part 1](/blog/2026-07-27-credential-injection-ai-agent-egress-cb4a/) I introduced the approaches discussed in the [CB4A paper](https://datatracker.ietf.org/doc/html/draft-hartman-credential-broker-4-agents-00) which lead us to an uncomfortable place: lots of credentials centralized into a token vault.

In [part 2](/blog/2026-08-03-protecting-token-vault-kms-credential-injection/) I walked through three ways to protect the token vault behind a credential broker, and landed on "Mode 3" where we separate out `kms:Encrypt` and `kms:Decrypt` entirely. Every unwrap needs a short-lived AWS KMS grant minted by a separate decision broker. The controller alone can't read/decrypt anything, the broker can authorize a decrypt but has no database or ciphertext to read, and a compromised controller can't mass decrypt the store. That's the property we want to keep.

{{< reuse-image src="img/blog/cb4a/mode3a.png" alt="Mode 3 — broker-gated KMS grants" >}}

In this blog I want to look at two things: the part of that design that falls over under real load (the KMS grant) and the variant I'd use instead, and the credentials Mode 3 doesn't protect no matter which variant you pick (the ones in use) along with a component I'd add to deal with them. Both change the recommendation I made at the end of part 2.

## KMS grants don't scale

When I posted part 2, [Stephane Nangue](https://www.linkedin.com/in/stephane-nangue-480a2557/) pushed back [in the comments](https://www.linkedin.com/posts/ceposta_credentials-vault-security-share-7490393823735566336-FWmz/) on two things. The second (per-user scoping is broker code rather than IAM) is now addressed in [updates to part 2](/blog/2026-08-03-protecting-token-vault-kms-credential-injection/) itself. The first is simple: Mode 3 doesn't scale, and the workarounds (caching, session-scoped grants, etc) put the standing decrypt right back. He's right.

So how bad is it? If you look at the [KMS request quotas](https://docs.aws.amazon.com/kms/latest/developerguide/requests-per-second.html), `CreateGrant` and `RetireGrant` default to 50 requests per second, per account, per region, while the shared symmetric `Decrypt` quota is 10,000 to 100,000 per second depending on the region. All of these are adjustable, but every token exchange in Mode 3 is three KMS calls (`CreateGrant`, `Decrypt`, `RetireGrant`), so the mint rate is the ceiling for the whole system, and it's a ceiling you share with every AWS service in the account that mints grants on your behalf (e.g. EBS creates one per encrypted volume attach). A shared enterprise gateway exchanging on every tool call will find 50 a second pretty quickly.

Grants are also durable. They don't expire, [somebody has to retire them](https://docs.aws.amazon.com/kms/latest/developerguide/grant-delete.html), and each key holds at most [50,000](https://docs.aws.amazon.com/kms/latest/developerguide/resource-limits.html#grants-per-key). A broker crash, a throttled `RetireGrant`, a bug in the retirement path, etc leaves grants stranded, and at the mint ceiling you fill the key in about 17 minutes, at which point `CreateGrant` returns `LimitExceededException` and every token exchange in the environment fails. And every grant that doesn't get retired is now "hidden" .. and becomes a row the controller can decrypt whenever it wants until someone notices. So if retirement is failing in the background you've basically drifted back to Mode 2 for every one of those rows, or worse (reaching limits and not issuing new grants -- crashes the system).

## Let's make the broker do Decrypt

We don't have to limit to the decrypt grant we send to the controller. We can flip who calls `Decrypt`. The broker gets standing `kms:Decrypt` but never touches the ciphertext, and the controller keeps the ciphertext with no `kms:Decrypt` at all. The controller still can't read a row on its own and the broker still has nothing to read, but instead of minting a grant and handing it back, the broker unwraps the DEK itself and returns it to the controller.

{{< reuse-image src="img/blog/cb4a/part25-broker-decrypt.png" alt="Broker performs the KMS decrypt while the controller holds the ciphertext" >}}

Let's walk through what the controller sends and what it gets back.

The controller sends the subject token, the freshness proof, the resource, the elicitation id, and the wrapped DEK. It does not send the encrypted payload, so the broker never sees a credential, only key material. The broker runs exactly the checks it ran in Mode 3: subject token signature and expiry against the IdP JWKS, freshness proof against the gateway's SVID, single-use `jti`, CEL policy, honeytoken rows, etc. Then it computes `owner = HMAC(sub)` from the subject token *it just verified*, builds the `EncryptionContext` from that, and calls `Decrypt`.

If the controller hands over Bob's wrapped DEK while presenting Alice's subject token, the broker presents Alice's `owner` and KMS fails the AAD check, same as it would have under a grant. KMS still enforces the owner binding, the broker just doesn't need a grant object to get there. CloudTrail still records `owner`/`resource`/`elicitation_id` on every decrypt, now under the broker's role instead of the controller's, and you join that against the broker's own decision log (neither of which lives in the controller). That's actually a cleaner audit story than Mode 3, because the controller has no business calling `Decrypt` at all, so any attempt from its identity is seen as an attack.

The DEK comes back over the mTLS connection between broker and controller, the controller opens the inner AES-GCM layer with it, hands the upstream token to the gateway, and zeroes the DEK. A DEK is per row and per write, so the controller holding one for the length of a request gets it exactly one credential.

Here's who holds what after the flip:

| Component | Holds | Cannot |
|---|---|---|
| **Controller** | ciphertext, the DB, the inner-layer decrypt once it has a DEK | call `kms:Decrypt`, reach the KEK |
| **Broker** | `kms:Decrypt`, IdP JWKS, gateway trust bundle, the owner HMAC key, policy | reach the DB, see ciphertext, see a credential payload |
| **KMS** | the KEK | application data |

## The rows the broker can't protect

[Part 2](/blog/2026-08-03-protecting-token-vault-kms-credential-injection/) asked "when the process holding the token store is fully compromised, how much of the store can the attacker read?"

Mode 3's answer is "only what the broker will authorize, right now, for this user, on this row," and I still think that's right.

But an attacker who owns the controller doesn't need to read the store. They can just sit on the controller and wait, because it's on the hot path for every legitimate exchange, and every one of those exchanges hands it a plaintext upstream credential. On a shared enterprise gateway exchanging on every tool call, every active user's GitHub/Slack/Jira/etc token passes through the controller in the clear within hours, and attackers usually aren't caught within hours.

It's also worse than just watching tokens go by. The DEK is per write, not per request, so once the controller gets the DEK for Alice's GitHub row it holds that DEK until a refresh rewrites the row, which means it can re-open that row whenever it wants without asking the broker again. Part 2 lists a DEK cache as a config mistake to validate against, but a compromised process caches whatever it wants.

And the payload the DEK opens is the entire "token response": access token, [refresh token](https://www.rfc-editor.org/rfc/rfc6749#section-1.5), id token. With the refresh token (and also, btw.. the OAuth client secret, which the controller also holds since it's the OAuth client that completed the elicitation in the first place) the attacker can mint new access tokens long after they've been evicted from the controller. Any row they see even once stays usable until somebody revokes the refresh token upstream.

{{< reuse-image src="img/blog/cb4a/part25-timeline.png" alt="Mode 3 protects credentials at rest while active credentials pass through the controller" >}}

So I need to narrow the claim I made at the end of part 2. Mode 3 prevents bulk decrypt of the rows that are **not in use** during the compromise. The rows that are in use leak as fast as they get used, and since the refresh token comes along with them, each one stays leaked. That's still a big improvement over Mode 2 (dormant users, which on a big install is most of them at any given moment, are safe from a controller compromise). But the goal "prevents mass decrypt" isn't right. I should have said that it only held for what the attacker could read at the moment of compromise. How much leaks depends on how long the attacker stays in the controller.

## Split the refresh token out

Access tokens die on their own ([GitHub App user-to-server tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens) expire in 8 hours if you turn on expiring tokens, [Slack access tokens](https://api.slack.com/authentication/rotation) in 12 hours with rotation enabled, [Google Cloud OAuth access tokens](https://docs.cloud.google.com/iam/docs/cloud-oauth-exchange-tokens) are typically issued for about an hour, etc), so an attacker harvesting access tokens at the rate of use will still be limited by time/expiry. An attacker harvesting refresh tokens only has to grab each user once. So I'd take the refresh token (and the client secrets that go with it) off the hot path entirely, into a fourth component I'll call the "refresher".

The refresher holds the refresh tokens and the OAuth client secrets, and it's the OAuth client that completes the authorization code exchange when a user authorizes an upstream, so the controller never sees the token response at creation either. Its store is Mode 3 again (envelope encrypted, broker-gated unwrap, same freshness proof), and its only output is a fresh access token for one row, on request. **A refresh token never leaves the refresher**, not to the controller, the gateway, or the broker. When a refresh is needed the refresher unwraps its own row in-process, calls the upstream token endpoint with the refresh token and the client secret, wraps and stores the rotated refresh token (GitHub rotates it on every use), zeroes the plaintext, and returns only the new access token. The controller's store holds access tokens and nothing else.

Here's who holds what with the refresher in place:

| Component | Holds | Never holds |
|---|---|---|
| **Controller** | access-token rows (ciphertext), elicitation state | refresh tokens, client secrets |
| **Refresher** | refresh-token rows (ciphertext), client secrets, the OAuth callback | subject tokens at rest, any ingress from the dataplane |
| **Broker** | `kms:Decrypt` (or mint authority), IdP JWKS, gateway trust bundle, the owner HMAC key, policy | ciphertext, the DB, DEKs at rest |
| **KMS** | the KEK (one key, or one per store, with distinct encryption contexts) | application data |

The read path doesn't change when the access token is still good. The controller sees the expiry in the row metadata (it's stored in the clear next to the ciphertext, so no unwrap is needed to check it), does the normal broker-gated unwrap, hands the token to the gateway. When the access token is expired, the controller goes to the refresher instead:

{{< reuse-image src="img/blog/cb4a/part25-refresher.png" alt="A separate refresher keeps refresh tokens and OAuth client secrets off the hot path" >}}

What makes the refresher a good place to concentrate the durable credentials is that the refresh path is slow. The hot path runs at one exchange per tool call. The refresh path runs at roughly active users divided by access-token TTL, ie, a few requests per second on a big install instead of thousands. So you can afford the strictest gating there, including KMS grants, which is a little funny given where this post started: grants don't scale on the hot path, but a low-volume, high-value path like this one is what they were built for. It also has no ingress from the dataplane, stores no subject tokens, and is a small amount of code, so if you ever go as far as putting part of this system in an enclave (e.g. [Nitro Enclaves](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html) with KMS attestation conditions), the refresher is the part I'd put there.

<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 1em 1.5em; margin: 1.5em 0; border-radius: 0 5px 5px 0; font-size: 1.1em; line-height: 1.6;">
<strong>The controller is on the hot path</strong> and will see plaintext for every active user no matter how you gate the unwrap. Make sure what it sees dies in hours. Keep the refresh tokens and the client secrets in a separate, broker-gated component that never hands them out, and have that component be the OAuth client.
</div>

What does this cost? A fourth component and a fourth trust domain, with its own identity, its own KMS context, and its own broker policy. The refresher is now where the long-lived credentials live, so compromising it is roughly Mode 2 posture for every user (live, audited, revocable upstream), which is why it gets no dataplane ingress and the tightest network policy in the system. If the refresher is down, exchanges start failing as access tokens expire, so your degradation window is the TTL, and the TTL floor is set by the upstream, not by you.

And it only helps for upstreams that have a refresh token to split out. Long-lived PATs, API keys, etc have no short-lived half, and those rows stay in the controller's store exactly as they are today.

## Where this leaves the series

Part 3 rebuilds Mode 3 on Vault/OpenBao, where the grant problem looks different and the broker-compromise risk above shows up again for the same reason. After that I want to look at taking plaintext out of the controller on the read path entirely, by having the gateway (which has to hold the token anyway, it's the thing putting it on the wire) do the final unwrap, which simplifies things but also puts some onus on the agent (but may be lessened if in a controlled platform). If you see a hole in this, tell me (Stephane did, which is why this post exists). Follow along / [connect on LinkedIn](https://linkedin.com/in/ceposta) if you are working through credential isolation for agent egress in your own stack.
