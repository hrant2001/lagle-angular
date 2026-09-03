const API_BASE_URL = 'https://wordle-api-kappa.vercel.app';

export interface CharacterInfo {
  char: string;
  scoring: {
    in_word: boolean;
    correct_idx: boolean;
  };
}

export interface GuessVerification {
  guess: string;
  is_correct: boolean;
  is_word_in_list: boolean;
  character_info?: CharacterInfo[];
}

export async function getWordOfDay(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/answer`);
  if (!response.ok) throw new Error('Failed to fetch the word of the day');

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' ||
      typeof (data as Record<string, unknown>)['word'] !== 'string' ||
      !/^[A-Za-z]{5}$/.test((data as Record<string, unknown>)['word'] as string)) {
    throw new Error('The word-of-the-day response was invalid');
  }

  return ((data as Record<string, unknown>)['word'] as string).toUpperCase();
}

export async function verifyGuess(guess: string): Promise<GuessVerification> {
  const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(guess.toLowerCase())}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to verify guess');

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' ||
      typeof (data as Record<string, unknown>)['is_correct'] !== 'boolean' ||
      typeof (data as Record<string, unknown>)['is_word_in_list'] !== 'boolean') {
    throw new Error('The guess verification response was invalid');
  }

  return data as GuessVerification;
}