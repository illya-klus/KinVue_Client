import { GatewayError, type ApiErrorBody } from "./errors";

const gatewayUrl =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

export type TokenPair = {
  accessToken: string;
  refreshToken?: string;
};

let getAccessToken: (() => string | null) | null = null;
let getRefreshToken: (() => string | null) | null = null;
let onTokens: ((tokens: TokenPair | null) => void) | null = null;

export function bindAuthHandlers(handlers: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokens: (tokens: TokenPair | null) => void;
}): void {
  getAccessToken = handlers.getAccessToken;
  getRefreshToken = handlers.getRefreshToken;
  onTokens = handlers.onTokens;
}

async function parseBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken?.() ?? null;
  if (!refreshToken) {
    return null;
  }
  const response = await fetch(`${gatewayUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    onTokens?.(null);
    return null;
  }
  const data = (await response.json()) as TokenPair;
  if (data.accessToken) {
    onTokens?.(data);
    return data.accessToken;
  }
  return null;
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
  let response = await fetch(url, { ...init, headers });

  if (
    response.status === 401 &&
    options?.retryOn401 !== false &&
    auth &&
    getRefreshToken?.()
  ) {
    const next = await refreshAccessToken();
    if (next) {
      headers.set("authorization", `Bearer ${next}`);
      response = await fetch(url, { ...init, headers });
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
