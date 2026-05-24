let currentToken: string | null = null;

export function getCurrentToken(): string | null {
  return currentToken;
}

export function setCurrentToken(token: string | null): void {
  currentToken = token;
}
