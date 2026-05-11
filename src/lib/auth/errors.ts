export class AuthError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = "Not signed in") {
    super("UNAUTHORIZED", 401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AuthError {
  constructor(message = "Admin role required") {
    super("FORBIDDEN", 403, message);
    this.name = "ForbiddenError";
  }
}
