import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

// Fails when the decorated property equals a sibling property on the same
// object — e.g. a new password that matches the current one. Compares with
// `!==` on the raw values: no trimming or case folding, because passwords are
// exact strings.
export function DiffersFromField(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'differsFromField',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [related] = args.constraints as [string];
          return value !== (args.object as Record<string, unknown>)[related];
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must differ from ${(args.constraints as [string])[0]}`;
        },
      },
    });
  };
}
