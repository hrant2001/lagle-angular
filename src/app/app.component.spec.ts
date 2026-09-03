import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppComponent,
  computeFeedback,
  isSavedGameState,
} from './app.component';
import { verifyGuess } from './word-list';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('Lagle game rules', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            guess: input.split('/').pop()?.toUpperCase(),
            is_correct: input.endsWith('/other'),
            is_word_in_list: input.endsWith('/which') || input.endsWith('/other'),
            character_info: [
              { char: 'W', scoring: { in_word: false, correct_idx: false } },
              { char: 'H', scoring: { in_word: true, correct_idx: false } },
              { char: 'I', scoring: { in_word: false, correct_idx: false } },
              { char: 'C', scoring: { in_word: false, correct_idx: false } },
              { char: 'H', scoring: { in_word: false, correct_idx: false } },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unexpected request'));
    }));
  });

  it('scores repeated letters using exact matches first', () => {
    expect(computeFeedback('ALLEY', 'EERIE')).toEqual([
      'absent', 'absent', 'absent', 'present', 'absent',
    ]);
  });

  it('reveals the previous guess only when the next guess is submitted', async () => {
    const game = new AppComponent();
    game.currentInput = 'WHICH';

    await game.submitGuess();
    expect(game.rows[0].feedback).toBeNull();

    game.currentInput = 'OTHER';
    await game.submitGuess();

    expect(game.rows[0].feedback).toEqual(computeFeedback('WHICH', 'OTHER'));
    expect(game.won).toBe(true);
  });

  it('persists an active valid game after each guess', async () => {
    const game = new AppComponent();
    game.currentInput = 'WHICH';

    await game.submitGuess();

    const saved = JSON.parse(storage.getItem('LAGLE_GAME_STATE') || '{}');
    expect(saved.rows).toHaveLength(1);
    expect(saved.gameOver).toBe(false);
  });

  it('rejects malformed saved state instead of restoring it', async () => {
    storage.setItem('LAGLE_LAST_PLAYED_DATE', new Date().toISOString().slice(0, 10));
    storage.setItem('LAGLE_GAME_STATE', '{not-json');

    const game = new AppComponent();

    expect(game.rows).toEqual([]);
    expect(storage.getItem('LAGLE_GAME_STATE')).toBeNull();
  });

  it('validates the shape of saved state', () => {
    expect(isSavedGameState({
      rows: [{ word: 'WHICH', feedback: null }],
      won: false,
      gameOver: false,
      message: '',
    })).toBe(true);
    expect(isSavedGameState({ rows: [{ word: 'BAD', feedback: null }] })).toBe(false);
  });

  it('posts a lowercase guess without a request body', async () => {
    await expect(verifyGuess('PLAIN')).resolves.toMatchObject({
      is_word_in_list: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://wordle-api-kappa.vercel.app/plain',
      { method: 'POST' }
    );
  });
});