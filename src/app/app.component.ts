import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WORD_LIST, getValidWords } from './word-list';

type LetterState = 'correct' | 'present' | 'absent';

interface GuessRow {
  word: string;
  // null = feedback not revealed yet (this is the one-turn-delay twist)
  feedback: LetterState[] | null;
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

  target = '';
  currentInput = '';
  rows: GuessRow[] = [];
  message = '';
  gameOver = false;
  won = false;
  isCorrect = false;

  // Best known status per letter, only updated once a guess is revealed.
  keyStatus: Record<string, LetterState> = {};

  constructor() {
    this.newGame();
  }

  newGame(): void {
    const lastPlayed = localStorage.getItem('LAGLE_LAST_PLAYED_DATE');
    const today = new Date().toISOString().slice(0, 10);
    
    if (lastPlayed === today) {
      const savedState = localStorage.getItem('LAGLE_GAME_STATE');
      if (savedState) {
        const { rows, won, gameOver, message, target } = JSON.parse(savedState);
        this.rows = rows;
        this.won = won;
        this.gameOver = gameOver;
        this.message = message;
        this.target = target;
        this.isCorrect = won;
        this.currentInput = '';
        this.keyStatus = {}; // Recompute keyboard status from rows
        this.rows.forEach(row => {
          if (row.feedback) this.updateKeyStatus(row.word, row.feedback);
        });
        return;
      }
    }

    const START_DATE = Date.UTC(2026, 0, 1);
    const now = Date.now();
    const todayUTC = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate()
    );

    const diffDays = Math.floor((todayUTC - START_DATE) / (1000 * 60 * 60 * 24));
    const index = diffDays % WORD_LIST.length;

    this.target = WORD_LIST[index].toUpperCase();
    // console.log('Target word:', this.target);
    this.currentInput = '';
    this.rows = [];
    this.message = '';
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
    if (this.gameOver) {
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
    if (this.gameOver) {
      return;
    }

    const guess = this.currentInput.trim().toUpperCase();

    if (guess.length !== 5) {
      this.message = 'Guess must be 5 letters.';
      return;
    }

    const validWords = await getValidWords();
    if (!validWords.includes(guess.toLowerCase())) {
      this.message = `"${guess}" isn't in the word list.`;
      return;
    }

    this.message = '';

    // THE TWIST: reveal feedback for the PREVIOUS guess now, not this one.
    if (this.rows.length > 0) {
      const prevRow = this.rows[this.rows.length - 1];
      if (prevRow.feedback === null) {
        prevRow.feedback = this.computeFeedback(prevRow.word);
        this.updateKeyStatus(prevRow.word, prevRow.feedback);
      }
    }

    this.isCorrect = guess === this.target;

    // A correct guess still confirms itself immediately -
    // otherwise you'd never know you'd actually won.
    const feedback = this.isCorrect ? this.computeFeedback(guess) : null;
    this.rows.push({ word: guess, feedback });
    if (feedback) {
      this.updateKeyStatus(guess, feedback);
    }

    if (this.isCorrect) {
      this.gameOver = true;
      this.won = true;
      this.message = `You got it! The word was ${this.target}.`;
      this.saveGameState();
    } else if (this.rows.length >= this.maxGuesses) {
      // Game's over either way, so reveal the final pending guess too.
      const lastRow = this.rows[this.rows.length - 1];
      lastRow.feedback = this.computeFeedback(lastRow.word);
      this.updateKeyStatus(lastRow.word, lastRow.feedback);
      this.gameOver = true;
      this.message = `Out of guesses. The word was ${this.target}.`;
      this.saveGameState();
    }

    this.currentInput = '';
  }

  private saveGameState(): void {
    localStorage.setItem('LAGLE_LAST_PLAYED_DATE', new Date().toISOString().slice(0, 10));
    localStorage.setItem('LAGLE_GAME_STATE', JSON.stringify({
      rows: this.rows,
      won: this.won,
      gameOver: this.gameOver,
      message: this.message,
      target: this.target
    }));
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

  private computeFeedback(guess: string): LetterState[] {
    const result: LetterState[] = new Array(5).fill('absent');
    const targetLetters = this.target.split('');
    const guessLetters = guess.split('');
    const used = new Array(5).fill(false);

    // First pass: exact position matches
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        result[i] = 'correct';
        used[i] = true;
      }
    }

    // Second pass: right letter, wrong position
    for (let i = 0; i < 5; i++) {
      if (result[i] === 'correct') {
        continue;
      }
      const idx = targetLetters.findIndex(
        (letter, j) => letter === guessLetters[i] && !used[j]
      );
      if (idx !== -1) {
        result[i] = 'present';
        used[idx] = true;
      }
    }

    return result;
  }
}