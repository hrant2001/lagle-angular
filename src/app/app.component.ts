import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getWordOfDay, verifyGuess } from './word-list';

type LetterState = 'correct' | 'present' | 'absent';

interface GuessRow {
  word: string;
  // null = feedback not revealed yet (this is the one-turn-delay twist)
  feedback: LetterState[] | null;
  pendingFeedback?: LetterState[];
}

export function computeFeedback(guess: string, target: string): LetterState[] {
  const result: LetterState[] = new Array(5).fill('absent');
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  const used = new Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const index = targetLetters.findIndex(
      (letter, j) => letter === guessLetters[i] && !used[j]
    );
    if (index !== -1) {
      result[i] = 'present';
      used[index] = true;
    }
  }

  return result;
}

function feedbackFromCharacterInfo(
  characterInfo: Array<{ scoring: { in_word: boolean; correct_idx: boolean } }> | undefined
): LetterState[] | null {
  if (!characterInfo || characterInfo.length !== 5) return null;
  return characterInfo.map(({ scoring }) =>
    scoring.correct_idx ? 'correct' : scoring.in_word ? 'present' : 'absent'
  );
}

function isValidFeedback(value: unknown): value is LetterState[] | null {
  return value === null || (
    Array.isArray(value) &&
    value.length === 5 &&
    value.every((state) => state === 'correct' || state === 'present' || state === 'absent')
  );
}

export function isSavedGameState(value: unknown): value is {
  rows: GuessRow[];
  won: boolean;
  gameOver: boolean;
  message: string;
} {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return Array.isArray(state['rows']) &&
    state['rows'].length <= 8 &&
    state['rows'].every((row) => {
      if (!row || typeof row !== 'object') return false;
      const candidate = row as Record<string, unknown>;
      return typeof candidate['word'] === 'string' &&
        /^[A-Z]{5}$/.test(candidate['word']) &&
        isValidFeedback(candidate['feedback']) &&
        (candidate['pendingFeedback'] === undefined || isValidFeedback(candidate['pendingFeedback']));
    }) &&
    typeof state['won'] === 'boolean' &&
    typeof state['gameOver'] === 'boolean' &&
    typeof state['message'] === 'string';
}

// Ranks how "good" a status is, so a key already marked correct
// never gets downgraded by a later present/absent result for that letter.
const STATUS_RANK: Record<LetterState, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly maxGuesses = 8;

  readonly keyboardRows: string[][] = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
  ];

  currentInput = '';
  rows: GuessRow[] = [];
  message = '';
  messageType: 'error' | 'info' | 'success' = 'info';
  gameOver = false;
  won = false;
  isCorrect = false;
  isSubmitting = false;

  // Best known status per letter, only updated once a guess is revealed.
  keyStatus: Record<string, LetterState> = {};

  constructor() {
    this.newGame();
  }

  newGame(): void {
    const storage = this.getStorage();
    const lastPlayed = storage?.getItem('LAGLE_LAST_PLAYED_DATE');
    const today = new Date().toISOString().slice(0, 10);

    if (lastPlayed === today) {
      const savedState = storage?.getItem('LAGLE_GAME_STATE');
      if (savedState) {
        try {
          const parsedState: unknown = JSON.parse(savedState);
          if (isSavedGameState(parsedState)) {
            this.rows = parsedState.rows;
            this.won = parsedState.won;
            this.gameOver = parsedState.gameOver;
            this.message = parsedState.message;
            this.messageType = parsedState.won ? 'success' : parsedState.gameOver ? 'error' : 'info';
            this.isCorrect = this.won;
            this.currentInput = '';
            this.keyStatus = {};
            this.rows.forEach((row) => {
              if (row.feedback) this.updateKeyStatus(row.word, row.feedback);
            });
            return;
          }
          storage?.removeItem('LAGLE_GAME_STATE');
        } catch {
          storage?.removeItem('LAGLE_GAME_STATE');
        }
      }
    }

    this.currentInput = '';
    this.rows = [];
    this.message = '';
    this.messageType = 'info';
    this.gameOver = false;
    this.won = false;
    this.isCorrect = false;
    this.keyStatus = {};
  }

  onInputChange(value: string): void {
    this.currentInput = value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
  }

  // Wired up to the on-screen keyboard buttons.
  onKeyClick(key: string): void {
    if (this.gameOver || this.isSubmitting) {
      return;
    }
    if (key === 'ENTER') {
      this.submitGuess();
      return;
    }
    if (key === 'BACK') {
      this.currentInput = this.currentInput.slice(0, -1);
      return;
    }
    if (this.currentInput.length < 5) {
      this.currentInput += key;
    }
  }

  async submitGuess(): Promise<void> {
    if (this.gameOver || this.isSubmitting) {
      return;
    }

    const guess = this.currentInput.trim().toUpperCase();

    if (guess.length !== 5) {
      this.message = 'Guess must be 5 letters.';
      this.messageType = 'error';
      return;
    }

    this.isSubmitting = true;
    let verification;
    try {
      verification = await verifyGuess(guess);
    } catch {
      this.message = 'Unable to verify that guess. Please try again.';
      this.messageType = 'error';
      this.isSubmitting = false;
      return;
    }
    if (!verification.is_word_in_list) {
      this.message = `"${guess}" isn't in the word list.`;
      this.messageType = 'error';
      this.isSubmitting = false;
      return;
    }

    this.message = '';
    this.messageType = 'info';

    // THE TWIST: reveal feedback for the PREVIOUS guess now, not this one.
    if (this.rows.length > 0) {
      const prevRow = this.rows[this.rows.length - 1];
      if (prevRow.feedback === null) {
        const feedback = prevRow.pendingFeedback;
        if (feedback) {
          prevRow.feedback = feedback;
          this.updateKeyStatus(prevRow.word, feedback);
        }
      }
    }

    this.isCorrect = verification.is_correct;

    // A correct guess still confirms itself immediately -
    // otherwise you'd never know you'd actually won.
    const apiFeedback = feedbackFromCharacterInfo(verification.character_info);
    const feedback = this.isCorrect
      ? Array.from({ length: 5 }, () => 'correct' as LetterState)
      : null;
    this.rows.push({ word: guess, feedback, pendingFeedback: apiFeedback || undefined });
    if (feedback) {
      this.updateKeyStatus(guess, feedback);
    }

    if (this.isCorrect) {
      this.gameOver = true;
      this.won = true;
      this.message = `You got it! The word was ${guess}.`;
      this.messageType = 'success';
    } else if (this.rows.length >= this.maxGuesses) {
      // Game's over either way, so reveal the final pending guess too.
      const lastRow = this.rows[this.rows.length - 1];
      const feedback = lastRow.pendingFeedback;
      if (feedback) {
        lastRow.feedback = feedback;
        this.updateKeyStatus(lastRow.word, feedback);
      }
      this.gameOver = true;
      this.message = 'Out of guesses. Loading the word of the day...';
      this.messageType = 'error';
      await this.revealAnswer();
    }

    this.currentInput = '';
    this.saveGameState();
    this.isSubmitting = false;
  }

  private async revealAnswer(): Promise<void> {
    try {
      const answer = await getWordOfDay();
      this.message = `Out of guesses. The word was ${answer}.`;
    } catch {
      this.message = 'Out of guesses. The word of the day could not be loaded.';
    }
  }

  private saveGameState(): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem('LAGLE_LAST_PLAYED_DATE', new Date().toISOString().slice(0, 10));
      storage.setItem('LAGLE_GAME_STATE', JSON.stringify({
        rows: this.rows, won: this.won, gameOver: this.gameOver,
        message: this.message
      }));
    } catch {
      this.message = 'Game progress could not be saved on this device.';
      this.messageType = 'error';
    }
  }

  private updateKeyStatus(word: string, feedback: LetterState[]): void {
    word.split('').forEach((letter, i) => {
      const newStatus = feedback[i];
      const existing = this.keyStatus[letter];
      if (!existing || STATUS_RANK[newStatus] > STATUS_RANK[existing]) {
        this.keyStatus[letter] = newStatus;
      }
    });
  }

  private getStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  tileLabel(letter: string, state: LetterState | null): string {
    const status = state ? `, ${state}` : ', feedback pending';
    return `${letter}${status}`;
  }
}