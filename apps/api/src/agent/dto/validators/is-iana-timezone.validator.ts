import { registerDecorator, ValidationOptions } from 'class-validator';

// Same check as the Zod refinement in @insula/contracts' agent.schemas.ts
// (CreateAgentSchema/UpdateAgentSchema use z.refine with an identical body)
// — duplicated rather than imported because class-validator decorators and
// Zod refinements are different shapes, but the check itself is one line
// and trivially kept in sync.
function isValidTimezone(tz: unknown): boolean {
  if (typeof tz !== 'string') {
    return false;
  }
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isValidTimezone,
        defaultMessage: () => 'Not a recognized IANA timezone',
      },
    });
  };
}
