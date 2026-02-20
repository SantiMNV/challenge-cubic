export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, options?: { code?: string; statusCode?: number; details?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = options?.code ?? "INTERNAL_ERROR";
    this.statusCode = options?.statusCode ?? 500;
    this.details = options?.details;
  }
}

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /timeout|rate.?limit|429|5\d\d/i.test(error.message);
}
