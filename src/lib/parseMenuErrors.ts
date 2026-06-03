export type ParseMenuErrorCode =
  | "no_files"
  | "unsupported_file_type"
  | "file_too_large"
  | "mock_failure"
  | "missing_backend"
  | "invalid_json"
  | "parse_timeout"
  | "empty_menu"
  | "server_config"
  | "provider_failure"
  | "invalid_request"
  | "mimo_timeout"
  | "unknown";

export class ParseMenuError extends Error {
  readonly code: ParseMenuErrorCode;
  readonly userMessage: string;

  constructor(code: ParseMenuErrorCode, userMessage: string, options: { cause?: unknown } = {}) {
    super(userMessage);
    this.name = "ParseMenuError";
    this.code = code;
    this.userMessage = userMessage;
    this.cause = options.cause;
  }
}

export function toParseMenuError(error: unknown): ParseMenuError {
  if (error instanceof ParseMenuError) {
    return error;
  }

  return new ParseMenuError(
    "unknown",
    "Something went wrong while reading the menu. Please try again.",
    { cause: error },
  );
}
