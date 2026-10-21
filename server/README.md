# Sentence server

Turns the words a person chose into one natural sentence. The app already writes a sentence with simple offline rules; the server can ask a language model for a nicer one. **The app shows the offline sentence at once and swaps in the server's only if it arrives in time AND passes the safety rule.** Without the server nothing is lost.

    cp .env.example .env        # put ANTHROPIC_API_KEY in it (optional: without it the server answers with the offline rules)
    npm run server              # WebSocket :8787 and plain TCP :8788, on 127.0.0.1
    npm run dev                 # then open  http://localhost:5173/?server=ws://localhost:8787

The key stays in the server process (`.env` is git-ignored); the browser never sees it. For a deployed build set `VITE_SENTENCE_URL=wss://…` at build time. The page address `?server=` is accepted **only for localhost**, so a link cannot send someone's words to a stranger's server. The comparison study (`?study=1`) never uses the server.

## Two doors, one service

- **WebSocket** (the app; browsers cannot open raw sockets). Only origins in `ALLOWED_ORIGINS` may connect.
- **Plain TCP socket**, one JSON message per line, for clients written like the lab's Python socket client: `python server/examples/client.py doctor help`.

## Messages (JSON; text frame over WebSocket, one line over TCP)

Request:

    {"id":"1","type":"suggest","words":["DOCTOR","HELP"],"place":"Clinic","attempt":0,"avoid":["Doctor help."]}
    {"id":"2","type":"ping"}

`words`: 1 to 12 words, letters only. `place`: Clinic, Shop, Work or Home. `attempt`: 0 first, +1 for each "try another". `avoid`: up to 3 sentences already shown. Answers carry the same `id`:

    {"id":"1","ok":true,"type":"suggest","sentence":"I need a doctor, please help.","source":"llm"}
    {"id":"1","ok":true,"type":"suggest","sentence":"Doctor help.","source":"offline","note":"language model answer rejected (added word)"}
    {"id":"2","ok":true,"type":"pong"}
    {"id":"x","ok":false,"error":"bad_request","message":"'place' must be one of Clinic, Shop, Work, Home"}

Errors: `bad_request`, `too_large` (over 4096 bytes), `rate_limited` (default 20 messages per 10 s per connection, bad messages count too), `server_error`.

## The safety rule (`src/nlp/validate.ts`, checked on the server AND again in the browser and in the state machine)

1. every chosen word is in the sentence (endings like -s, -ed, -ing are fine);
2. nothing else is added except a small list of helper words (articles, pronouns, "please", "need", "want", …). No new nouns, names, numbers, times, places or negations;
3. at most 25 words, two sentences, plain letters and punctuation, no links.

If the model's sentence breaks it, is slow (4 s), fails, or repeats a sentence the person has seen, the server answers with the offline sentence and says why in `note`. The app also never uses an answer whose source is not the language model. The server logs only the kind of problem (for example "added word"), never the person's words.

## Verified, and not

Verified here: protocol parsing, the rule on many cases (including the offline builder for every card pack), the service's fallbacks with a fake model, the Anthropic request format with a fake HTTP client, real WebSocket and real TCP sockets, origin refusal, rate limiting, the app with a real server, a server that is down and a hostile one (`npm run e2e:server`).
**Not verified: the real language model.** No call to the Anthropic API was made (no key in the build environment): the model name in `.env.example` and the prompt are untested against the live API, and the quality of its sentences is unknown. Try it with a key, then read `note` on the answers for how often the rule rejects it.
