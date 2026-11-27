export class DomainError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export class DomainValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('DOMAIN_VALIDATION_ERROR', message, details);
    this.name = 'DomainValidationError';
  }
}

export class ConstraintViolationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('CONSTRAINT_VIOLATION', message, details);
    this.name = 'ConstraintViolationError';
  }
}

export class InvalidTournamentStateError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('INVALID_TOURNAMENT_STATE', message, details);
    this.name = 'InvalidTournamentStateError';
  }
}
