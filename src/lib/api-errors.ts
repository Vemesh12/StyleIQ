import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

// Translates the Prisma errors that are caused by bad client input into
// proper 4xx responses, so a duplicate slug or an unknown id doesn't surface
// as a generic 500.

export function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

/** Returns a 4xx response for known input errors, or null for real server errors. */
export function clientErrorResponse(
  error: unknown,
  messages: { unique?: string; foreignKey?: string; notFound?: string } = {}
): NextResponse | null {
  switch (prismaErrorCode(error)) {
    case 'P2002': // unique constraint
      return NextResponse.json({ error: messages.unique ?? 'That value is already in use.' }, { status: 409 });
    case 'P2003': // foreign key constraint
      return NextResponse.json({ error: messages.foreignKey ?? 'A referenced item does not exist.' }, { status: 400 });
    case 'P2025': // record to update/delete not found
      return NextResponse.json({ error: messages.notFound ?? 'Not found.' }, { status: 404 });
    default:
      return null;
  }
}
