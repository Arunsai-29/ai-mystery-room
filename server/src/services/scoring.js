export function scoreAccusation(correct, hintsUsed = 0) { return correct ? Math.max(0, 100 - 10 * hintsUsed) : 0; }
