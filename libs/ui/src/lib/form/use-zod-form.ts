'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormProps } from 'react-hook-form';
import type { ZodType, z } from 'zod';

export function useZodForm<TSchema extends ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>,
) {
  // `zodResolver`'s overloads require the schema's inferred output to line
  // up exactly with the resolver's type parameters. TSchema is generic here
  // (constrained, not concrete), so TS can't prove that equality on its own
  // even though it holds by construction — the cast bridges that gap without
  // widening anything callers of useZodForm see, since the exported generic
  // signature is untouched.
  type SchemaOutput = z.infer<TSchema>;
  const resolver = zodResolver(schema as unknown as ZodType<SchemaOutput, SchemaOutput>);
  return useForm<SchemaOutput>({ ...options, resolver });
}
