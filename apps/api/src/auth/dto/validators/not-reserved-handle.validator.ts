import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { RESERVED_HANDLES } from '@insula/contracts';

// Used via @Validate(NotReservedHandleConstraint) on RegisterDto.handle.
// Reuses RESERVED_HANDLES from @insula/contracts so the list is defined once.
@ValidatorConstraint({ name: 'notReservedHandle', async: false })
export class NotReservedHandleConstraint implements ValidatorConstraintInterface {
  validate(handle: unknown): boolean {
    return typeof handle === 'string' && !RESERVED_HANDLES.has(handle);
  }

  defaultMessage(): string {
    return 'This handle is reserved';
  }
}
