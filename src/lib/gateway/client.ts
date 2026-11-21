import { GatewayError, type ApiErrorBody } from "./errors";

const gatewayUrl =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

export type TokenPair = {
  accessToken: string;
};

let getAccessToken: (() => string | null) | null = null;
let onTokens: ((tokens: TokenPair | null) => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let sessionVersion = 0;
export function invalidateSessionRefresh() {
  sessionVersion += 1;
}

export function bindAuthHandlers(handlers: {
  getAccessToken: () => string | null;
  onTokens: (tokens: TokenPair | null) => void;
}): void {
  getAccessToken = handlers.getAccessToken;
  onTokens = handlers.onTokens;
}

async function parseBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const version = sessionVersion;
  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${gatewayUrl}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const data = response.ok ? ((await response.json()) as TokenPair) : null;
      if (version !== sessionVersion) return null;
      onTokens?.(data?.accessToken ? data : null);
      return data?.accessToken ?? null;
    } catch {
      if (version === sessionVersion) onTokens?.(null);
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function gatewayFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: { auth?: boolean; retryOn401?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers);
  const auth = options?.auth !== false;
  if (auth) {
    const token = getAccessToken?.();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }
  const url = path.startsWith("http") ? path : `${gatewayUrl}${path}`;
  let response = await fetch(url, { ...init, headers, credentials: "include" });

  if (
    response.status === 401 &&
    options?.retryOn401 !== false &&
    auth &&
    getAccessToken?.()
  ) {
    const current = getAccessToken?.();
    const next =
      current && headers.get("authorization") !== `Bearer ${current}`
        ? current
        : await refreshAccessToken();
    if (next) {
      headers.set("authorization", `Bearer ${next}`);
      response = await fetch(url, { ...init, headers, credentials: "include" });
    }
  }

  if (!response.ok) {
    throw new GatewayError(response.status, await parseBody(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
