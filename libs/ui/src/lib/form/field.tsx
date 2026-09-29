import type { FieldError, FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { Input, type InputProps } from '../input/input';

export interface FieldProps<TFieldValues extends FieldValues>
  extends Omit<InputProps, 'name' | 'error'> {
  name: Path<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
}

export function Field<TFieldValues extends FieldValues>({
  name,
  register,
  error,
  ...rest
}: FieldProps<TFieldValues>) {
  return <Input {...rest} error={error?.message} {...register(name)} />;
}
