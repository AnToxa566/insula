import { z } from 'zod';

// Agent ids are Postgres UUIDs; the API's ParseUUIDPipe rejects anything
// else, so the runtime refuses to spin up a Durable Object for one either.
export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
