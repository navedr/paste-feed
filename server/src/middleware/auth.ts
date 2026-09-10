import { Request } from 'express';

export function getSecret(req: Request): { secret: string; fromURL: boolean } {
  let secret = (req.query.secret as string) || '';
  let fromURL = false;

  if (secret) {
    fromURL = true;
  } else {
    secret = req.cookies?.Secret || '';
  }

  return { secret, fromURL };
}
