import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiEnvelope<T>>({ data, error: null }, init);
}

export function err(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json<ApiEnvelope<never>>(
    { data: null, error: { code, message, details } },
    { status },
  );
}

export function fromZod(e: ZodError) {
  return err(
    "validation_error",
    "Invalid input",
    422,
    e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export function handleUnknown(e: unknown) {
  if (e instanceof ZodError) return fromZod(e);
  const message = e instanceof Error ? e.message : String(e);
  return err("internal_error", message, 500);
}
