# Lotería Familiar

A family lotería game. Multiple phones in the room, one host, real-time card calling.

## What's in the box

- **Expo (React Native + TypeScript)** — iOS + Android from one codebase.
- **Supabase** — auth (Google, Apple, email/password), Postgres, realtime, storage.
- **OpenAI** (via Supabase Edge Functions) — `gpt-image-1` for custom card art, `gpt-4o-mini-tts` for the Spanish caller voice. Keys live server-side only.

## Gameplay

- 4×4 tablas, 16 cards drawn from the 54-card traditional deck.
- One person hosts a game; others join via 6-char code or QR.
- Called cards appear at the top of every player's screen in real time.
- Player's own tabla on the bottom — **tap a card to mark it**.
- AI caller auto-advances on a host-set tempo (slow/medium/fast). Host can pause.
- Win modes: **corners**, **row/column/diagonal**, or **full board**.
- Slam **¡LOTERÍA!** to claim a win. The server verifies every marked card was actually called.
  False claim = out for the round (toggleable).

## Setup

```bash
cd projects/loteria
npm install
cp .env.example .env  # fill in EXPO_PUBLIC_SUPABASE_URL and ANON_KEY
```

### Supabase

1. Create a project at supabase.com.
2. SQL editor → paste `supabase/schema.sql` → run.
3. Storage → create a **public** bucket named `card-art`.
4. Authentication → Providers → enable **Email**, **Google**, **Apple**. Paste OAuth credentials when you have them.
5. Edge Functions → deploy:
   ```bash
   supabase functions deploy generate-card
   supabase functions deploy tts
   supabase secrets set OPENAI_API_KEY=sk-...
   ```

### Run

```bash
npm run ios       # iOS simulator (Mac)
npm run android   # Android emulator
npm start         # then scan QR with Expo Go on your phone
```

## File map

```
App.tsx                          ← root + simple state router
src/
  contexts/
    AuthContext.tsx              ← Supabase session
    GameContext.tsx              ← realtime game state, the brain
    LocaleContext.tsx            ← ES/EN toggle
  data/cards.ts                  ← 54 cards + traditional Spanish verses
  game/
    types.ts
    engine.ts                    ← tabla generation, shuffle, win detection
  lib/
    supabase.ts
    openai.ts                    ← thin client; real keys live in edge fns
    i18n.ts
  components/
    CardImage.tsx                ← default or custom art per card
    TablaGrid.tsx                ← 4×4 tap-to-mark
    CalledCardsBanner.tsx        ← top-of-screen current + history
  screens/
    AuthScreen.tsx
    HomeScreen.tsx
    HostLobbyScreen.tsx          ← QR + code + win mode + tempo
    JoinScreen.tsx               ← code entry + QR scan
    GameScreen.tsx               ← the live game
    CustomizeScreen.tsx          ← per-card photo or AI swap
supabase/
  schema.sql
  functions/
    generate-card/index.ts       ← OpenAI image gen
    tts/index.ts                 ← OpenAI Spanish TTS
```

## What's stubbed for now

- **OAuth keys**: Google and Apple sign-in buttons are wired up, but you need to plug credentials into Supabase Auth.
- **OpenAI key**: edge functions are deployed-ready but won't return anything until `OPENAI_API_KEY` is set. The TTS gracefully falls back to native `expo-speech` Spanish if the function fails.
- **Card art**: every card shows a numbered placeholder until you either generate or upload custom art. We'll generate a default set later.
