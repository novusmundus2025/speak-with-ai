# Speak with AI

A glasses-first German conversation assistant for Even G2, powered by local Whisper transcription and MundusX. It listens to a German conversation, transcribes audio on the paired phone, explains the meaning and topic in English, then offers three German replies:

- a supportive response;
- a context-aware continuation;
- an alternative or politely opposing response.

Every suggestion includes a short purpose label and its English meaning, so the wearer knows what they are about to say.

## Run the browser prototype

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open the displayed local URL. Mock mode is enabled by default and demonstrates a German dinner invitation without calling an external service.

## Local German transcription

Set `VITE_USE_MOCK_TRANSCRIPTION=false` to enable multilingual Whisper Tiny. The model runs in a Web Worker through Transformers.js, consumes the G2's 16 kHz PCM stream, and sends only the finalized German transcript to the application service. Model files are retained in the browser cache after the first download.

For production, host the model files on a controlled MundusX domain and update the model setting and Even Hub network whitelist accordingly.

## Connect MundusX

The client expects this endpoint:

```text
POST {VITE_MUNDUSX_API_URL}/api/glasses/conversation
```

Set `VITE_USE_MOCK_MUNDUSX=false` when the endpoint is ready. Authentication should use a secure same-site session or short-lived token. Never expose a permanent API secret through a `VITE_*` environment variable because Vite embeds those values in the client bundle.

The request contains the finalized German transcript, language preferences, and recent conversation turns. No audio is uploaded. The expected response contract is represented by `ConversationResult` in `src/types.ts`.

## Test on Even G2

1. Pair and update the G2 in the Even Realities app.
2. Enable Developer Mode in Even Hub.
3. Start the local server with `npm.cmd run dev`.
4. Generate a QR code using the LAN URL printed by Vite:

```powershell
npx.cmd evenhub qr --url http://YOUR-LAN-IP:5173
```

5. Scan the QR code from the developer section of the Even Realities app.

The glasses interaction is:

- press: start/stop listening or select;
- swipe up/down: browse replies;
- double-press: reset the conversation.

## Build and package

```powershell
npm.cmd run build
npm.cmd run pack:g2
```

The packaged `.ehpk` file is ignored by Git.
