# Lagle

The one-turn-lag word game. You never see feedback for the guess you just
made — only for the one before it. Plan two moves ahead.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:4200

Run the unit tests with:

```bash
npm test
```

## How it works

- Guesses are verified with `POST https://wordle-api-kappa.vercel.app/{guess}`
  without a request body. The API response supplies validity, correctness, and
  per-character scoring.
- After you submit a guess, the colored feedback (green/yellow/gray, same
  rules as Wordle) for your **previous** guess appears — not your current one.
- Your most recent guess always shows as "pending" (no color) until your
  next guess reveals it.
- You have 8 guesses total (one more than standard Wordle, to offset the
  lag).
- If you guess correctly, that guess is confirmed immediately so you know
  you've won.
- Completed and in-progress daily games are saved locally and restored on
  refresh.

## Files

- `src/app/app.component.ts` — game state and the delayed-feedback logic
- `src/app/app.component.html` — board and input UI
- `src/app/app.component.css` — styling
- `src/app/word-list.ts` — API client for guess verification
- `src/app/app.component.spec.ts` — unit tests for game rules and persistence
