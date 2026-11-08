export type ApiErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string;
  code?: string;
};

export class GatewayError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
    message?: string,
  ) {
    super(message ?? body?.message ?? `Request failed (${status})`);
    this.name = "GatewayError";
  }
}
