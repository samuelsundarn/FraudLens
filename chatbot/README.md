# FraudLens Assistant (chatbot module)

Self-contained: delete this folder plus the 2 lines in `backend/app/main.py` and the `ChatWidget` lines in `frontend/src/App.jsx` and the app still runs.

```
chatbot/
  backend/   env.py (loads .env) · config.py (all settings) · prompts.py (persona + rules)
             knowledge.py (what the bot knows) · gemini.py (API client) · history.py (saved chats) · router.py (/api/chat)
  frontend/  ChatWidget.jsx (UI) · chatApi.js · chatbot.css
  knowledge/ *.md files - add or edit to teach the bot new facts (no code change, picked up automatically)
  data/history/  one JSON file per browser session (this is the chat memory)
```

## Common tweaks
| Want to... | Change |
|---|---|
| Different model | `GEMINI_MODEL` in `.env` (e.g. `gemini-2.5-pro`) |
| Tone, rules, scope | `backend/prompts.py` |
| Teach new facts | add/edit `knowledge/*.md` (README and docs/ are read too) |
| Longer / shorter memory | `CHATBOT_CONTEXT_TURNS`, `CHATBOT_STORE_LIMIT` in `.env` |
| Suggested questions, title, position | top of `frontend/ChatWidget.jsx` and `frontend/chatbot.css` |
| Turn off | `CHATBOT_ENABLED=false` |

The API key stays on the server; the browser never sees it.
Endpoints: `GET /api/chat/status`, `POST /api/chat`, `GET|DELETE /api/chat/history?session_id=`.
Test: `python chatbot/test_chatbot.py` (no key needed, Gemini is faked).
