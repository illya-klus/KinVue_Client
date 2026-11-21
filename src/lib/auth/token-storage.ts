let accessTokenInMemory: string | null = null;

export function readTokens(): {
  accessToken: string | null;
} {
  if (typeof window === "undefined") {
    return { accessToken: null };
  }
  return {
    accessToken: accessTokenInMemory,
  };
}

export function writeTokens(accessToken: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  accessTokenInMemory = accessToken;
  // Discard tokens persisted by older client versions; never restore them.
  try {
    for (const key of ["kinvue.accessToken", "kinvue.refreshToken"]) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  } catch {
    /* Storage can be disabled; the session uses memory and HttpOnly cookies. */
  }
}

export function clearTokens(): void {
  writeTokens(null);
}

export function decodeJwtScopes(token: string): string[] {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return [];
    }
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const scopes = json.scope ?? json.scopes ?? json.scp;
    if (typeof scopes === "string") {
      return scopes.split(/\s+/).filter(Boolean);
    }
    if (Array.isArray(scopes)) {
      return scopes.map(String);
    }
    return [];
  } catch {
    return [];
  }
}
