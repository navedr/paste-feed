export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class FeedNotFoundError extends AppError {
  constructor(feedName?: string) {
    super(feedName ? `feed '${feedName}' not found` : 'feed not found', 404);
    this.name = 'FeedNotFoundError';
  }
}

export class InvalidSecretError extends AppError {
  constructor() {
    super('invalid Secret', 401);
    this.name = 'InvalidSecretError';
  }
}

export class IncorrectSecretError extends AppError {
  constructor() {
    super('incorrect Secret', 401);
    this.name = 'IncorrectSecretError';
  }
}

export class FeedAlreadyExistsError extends AppError {
  constructor() {
    super('feed already exists', 409);
    this.name = 'FeedAlreadyExistsError';
  }
}

export class ItemNotFoundError extends AppError {
  constructor(itemName?: string) {
    super(itemName ? `feed item not found: ${itemName}` : 'feed item not found', 404);
    this.name = 'ItemNotFoundError';
  }
}

export class InvalidContentTypeError extends AppError {
  constructor(contentType?: string) {
    super(contentType ? `invalid content-type: ${contentType}` : 'invalid content-type', 400);
    this.name = 'InvalidContentTypeError';
  }
}

export class MaxBodySizeExceededError extends AppError {
  constructor() {
    super('max body size exceeded', 413);
    this.name = 'MaxBodySizeExceededError';
  }
}

export class ItemEmptyError extends AppError {
  constructor() {
    super('feed item is empty', 400);
    this.name = 'ItemEmptyError';
  }
}

export class PinExpiredError extends AppError {
  constructor() {
    super('feed pin expired', 401);
    this.name = 'PinExpiredError';
  }
}

export class PinIncorrectError extends AppError {
  constructor() {
    super('feed pin incorrect', 401);
    this.name = 'PinIncorrectError';
  }
}

export class PinIncorrectLengthError extends AppError {
  constructor() {
    super('feed pin length is not 4', 400);
    this.name = 'PinIncorrectLengthError';
  }
}

export class InvalidFeedItemError extends AppError {
  constructor() {
    super('invalid feed item, cannot get internal files', 400);
    this.name = 'InvalidFeedItemError';
  }
}
