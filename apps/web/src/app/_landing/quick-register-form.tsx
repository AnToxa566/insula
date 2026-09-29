'use client';

import { useRouter } from 'next/navigation';

import { QuickRegisterSchema, type QuickRegisterInput } from '@insula/contracts';
import { Button, Field, useGuardedSubmit, useZodForm } from '@insula/ui';
import { extractErrorMessage, registerQuick } from '@insula/web-auth';

import { AppRoute } from '../../lib/routes';

// The landing hero's one-field signup: email only, everything else is
// generated server-side (see apps/api/src/auth/auth.service.ts
// `registerQuick`). Any failure — invalid email, a taken email, or a
// network/server error — surfaces under the same input, since it's the
// only field there is; see the SignUpForm's server-error convention for the
// multi-field version of this.
export function QuickRegisterForm() {
  const router = useRouter();
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useZodForm(QuickRegisterSchema);

  const onSubmit = handleSubmit(
    useGuardedSubmit(async (values: QuickRegisterInput) => {
      try {
        await registerQuick(values);
        router.replace(AppRoute.Home);
      } catch (err) {
        setError('email', {
          type: 'server',
          message: extractErrorMessage(err, 'Could not create your account. Try again.'),
        });
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-start gap-2">
      <div className="flex-1 basis-[200px]">
        <Field<QuickRegisterInput>
          name="email"
          register={registerField}
          error={errors.email}
          variant="white"
          type="email"
          placeholder="you@example.com"
          aria-label="Email"
          autoComplete="email"
        />
      </div>
      <Button type="submit" variant="primary" size="input" className="flex-none w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? <i className="ri-loader-4-line animate-spin" aria-hidden="true" /> : 'Create account'}
      </Button>
    </form>
  );
}

export default QuickRegisterForm;
