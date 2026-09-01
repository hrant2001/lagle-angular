# Lagle

The one-turn-lag word game. You never see feedback for the guess you just
made — only for the one before it. Plan two moves ahead.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:4200

## How it works

- Every guess must be a real 5-letter word from `src/app/word-list.ts`.
- After you submit a guess, the colored feedback (green/yellow/gray, same
  rules as Wordle) for your **previous** guess appears — not your current one.
- Your most recent guess always shows as "pending" (no color) until your
  next guess reveals it.
- You have 8 guesses total (one more than standard Wordle, to offset the
  lag).
- If you guess correctly, that guess is confirmed immediately so you know
  you've won.

## Files

- `src/app/app.component.ts` — game state and the delayed-feedback logic
- `src/app/app.component.html` — board and input UI
- `src/app/app.component.css` — styling
- `src/app/word-list.ts` — target/guess word list (swap in your own list
  or a bigger dictionary anytime)
