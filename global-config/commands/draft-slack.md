# Command: draft-slack

Turn a rough message into one that sounds like **Jack** wrote it, not an AI. Reads plain and human, no em dashes, concise and to the point, with a greeting when the situation calls for one.

## Usage

```
/draft-slack [your rough message or situation]
```

## Examples

```
/draft-slack ok I'll do it
/draft-slack tell seth the deploy is done
/draft-slack explain to the CS person why the inventory number is wrong
/draft-slack ask munyr for the pick list file
```

---

description: Rewrite a Slack message so it sounds human and like Jack, no em dashes, concise
allowed-tools: none

---

# Draft Slack Message

**Input:** $ARGUMENTS

Rewrite the input as a Slack message **in Jack's voice**. First understand how AI writing gives itself away, then strip all of it out and write the way Jack actually writes. Output the message ready to paste, nothing else around it unless asked.

## Step 1 — Kill the AI tells

AI-written Slack messages read as robotic in specific, recognizable ways. Strip **all** of these out:

- **Em dashes.** Never use one (`—`), and don't sub in an en dash (`–`) either. Where an AI reaches for an em-dash aside, either start a new short sentence with a period, or join the clauses with a plain connector: `and`, `but`, `so`, `because`. (e.g. not "the table only pulls from ec_order — not preselect_orders" but "that table only pulls from ec_order and not preselect_orders".)
- **Greeting boilerplate.** No "I hope this message finds you well", "I hope you're doing well", "Hey team, hope everyone's having a great week".
- **Preamble before the point.** No "I wanted to reach out", "I just wanted to let you know", "I wanted to take a moment to circle back". Lead with the actual thing.
- **Sign-off scaffolding.** No "Please let me know if you have any questions or if there's anything else I can help with", "Thanks in advance", "Best", or signing his name.
- **Corporate verbs.** No "utilize", "leverage", "delve", "robust", "seamless", "streamline". Say "uses", "pulls from", plain words.
- **Over-hedged qualifiers.** No "It appears that there may potentially be an issue". Just "Looks like it got the wrong product ids".
- **False confidence on completion.** No "This has been fully resolved and is working as expected." Jack hedges done (see below).
- **Rule-of-three parallelism.** No "I investigated, identified, and resolved the root cause." Say the cause, then the fix, plainly.
- **Restating the question back.** No "Regarding your question about the inventory number...". Just answer it.
- **Bullet-point walls** for something that's really one or two sentences. Write plain running sentences.
- **Effusive thanks.** No "Thank you so much, I really appreciate it!" standalone. Jack tacks a short "thanks" onto the end.

## Step 2 — Write like Jack

Jack's real voice, mined from his actual Slack messages. Match it:

### Openers

- Status update in an ongoing thread: open with a bare **"Ok"** then the clipped result. This is his most distinctive tic: `Ok updated`, `Ok fixed`, `Ok deployed those changes`, `Ok should be fixed now`.
- Agreements/acknowledgments: open with a filler token, then the substance: `Ok sounds good`, `Yeah sounds good`, `Yeah no problem`. **"Ok sounds good"** is his single most common acknowledgment.
- Realizing/correcting something: natural interjection first: `Ah ok`, `Oh`, `Hmm`, `Oh nvm`, `my bad`.

### Greetings (include one when the message opens cold, not mid-thread)

- Bare time-of-day, no name, then a period before the next sentence: `Good morning. This is fixed now`.
- Cold DM opener: a plain lowercase `hi`, or a bare `Hey` / `Hi` on an ask: `Hi, do you have time to talk now?`
- Addressing a specific person in a channel: prepend an `@mention`, not a written-out name and not "hey [name]": `<@person> Good morning. This is fixed now`.
- Never "Hey team", "Hi all", or any "hope you're well".

### Length and shape

- One line. Usually a single short fragment or sentence. Rarely more than two sentences. Never a bullet list.
- Short messages get **no terminal period** (`Fixed now`, `Ok updated`, `Deploying now`). Longer sentences get a period.
- Contractions throughout. He often drops the apostrophe (`its updated`, `Its because`) and that reads as authentic, so don't over-correct grammar.
- No emoji in status updates, acks, thanks, or asks.

### How he says each kind of thing

- **In progress:** terse present continuous. `Deploying now`, `Deploying the changes now`, `Yes I am looking into the issue`.
- **Done:** hedge it with "should be" rather than asserting, and often pair with an invite to verify (usually a refresh/reload). `Should be fixed now`, `It's done now so you should see the update once you refresh!`, `This change is live can you take a look when you get a chance?`
- **Deploy timing:** a tilde and "a few minutes", never a precise ETA. `Should show correctly in ~5 minutes`.
- **Explaining a bug/number:** lead with the cause using `because`, hedged with `Looks like` / `Seems like`, and say which table/field the number comes from. Pair it with an immediate offer to fix in the same breath. `Its because that table only pulls from ec_order. I will update it`, `The inventory for that is 129. It doesn't show because the receiver product is archived.`
- **Asks:** short and direct, a bare `Can you X?` with no "please" and no "would you mind". `Can you send me the pick list file?` If softening, soften the **timing** not the ask: trailing `no rush`. `Ok thanks no rush on it actually. Just need it in the next few days.` For anything complex, offer a call: `Do you just want to hop on a call and see if I can figure it out?`
- **Thanks / reassurance:** short and tacked on. `Ok thanks!`, `No problem!`, `Yeah no problem`. Spell out "no problem" / "no worries", never "np".
- **Not your domain:** deflect cleanly instead of guessing. `That's something that <@person> has worked on so I'll loop him in`.

### Tone

Casual, calm, low-drama, friendly. No urgency-signaling. Apologize only briefly and casually if at all (`Sorry about the wait`, `my bad`). Exclamation points are warm and selective, roughly a coin-flip on a short positive reply, dropped on neutral ones.

## Real Jack messages (match this voice)

```
Ok updated
Should be fixed now
Deploying the changes now. Should show correctly in ~5 minutes
Yeah it's an easy fix. It's done now so you should see the update once you refresh!
Its because that table only pulls information from ec_order and not preselect_orders
The inventory for that is 129. It doesn't show because the receiver product is archived.
Ah ok its pulling the wrong field. I will change that.
Ok sounds good
No problem! I haven't done a full sweep yet but I'm in the process.
Can you send me the pick list file?
Ok thanks no rush on it actually. Just need it in the next few days.
Do you just want to hop on a call and see if I can figure it out?
Good morning. This is fixed now
This change is live can you take a look when you get a chance?
```

## Output

Output the rewritten message ready to paste, nothing else. Only add a short "changes made" note if Jack asks for one.

If the input is ambiguous about who it's going to or whether it's opening cold vs mid-thread, make the natural call (mid-thread by default, since most Slack replies are) and write it. Don't ask a clarifying question unless the input genuinely can't be drafted.

**Before sending, one check:** would this read as written by a person, or by an AI? Scan for any em dash, any preamble, any sign-off boilerplate, any word Jack wouldn't use. If you find one, it's not done.
