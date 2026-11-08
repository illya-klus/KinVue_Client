const ACCESS_KEY = "kinvue.accessToken";
const REFRESH_KEY = "kinvue.refreshToken";

export function readTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null };
  }
  return {
    accessToken: sessionStorage.getItem(ACCESS_KEY),
    refreshToken: sessionStorage.getItem(REFRESH_KEY),
  };
}

export function writeTokens(
  accessToken: string | null,
  refreshToken: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (accessToken) {
    sessionStorage.setItem(ACCESS_KEY, accessToken);
  } else {
    sessionStorage.removeItem(ACCESS_KEY);
  }
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    sessionStorage.removeItem(REFRESH_KEY);
  }
}

export function clearTokens(): void {
  writeTokens(null, null);
}

export function decodeJwtScopes(token: string): string[] {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return [];
    }
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
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
