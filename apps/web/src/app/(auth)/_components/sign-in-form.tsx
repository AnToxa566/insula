'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { LoginSchema, type LoginInput } from '@insula/contracts';
import { Button, Field, useGuardedSubmit, useZodForm } from '@insula/ui';
import { extractErrorMessage, login } from '@insula/web-auth';

import { AppRoute } from '../../../lib/routes';

export function SignInForm() {
  const router = useRouter();
  const form = useZodForm(LoginSchema);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(
    useGuardedSubmit(async (values: LoginInput) => {
      try {
        await login(values);
        router.replace(AppRoute.Feed);
      } catch (err) {
        // Deliberately never field-specific: apps/api/src/auth/auth.service.ts
        // returns the same 401 for "no such user" and "wrong password" to
        // avoid email enumeration, and pointing the error at a field would
        // defeat that.
        setError('root', { message: extractErrorMessage(err) });
      }
    }),
  );

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <div className="text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink">Sign in</div>

      <Button type="button" variant="secondary" size="md" className="w-full flex items-center justify-center gap-2.5">
        <i className="ri-google-fill text-[18px] text-ink" aria-hidden="true" />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-[13px] text-ink-muted">
        <div className="h-px flex-1 bg-line" />
        or with email
        <div className="h-px flex-1 bg-line" />
      </div>

      {errors.root?.message ? (
        <p className="rounded-input bg-[#F8E9E6] px-3 py-2 text-[13px] text-danger">{errors.root.message}</p>
      ) : null}

      <Field<LoginInput> label="Email" name="email" register={registerField} error={errors.email} type="email" autoComplete="email" />
      <Field<LoginInput>
        label="Password"
        name="password"
        register={registerField}
        error={errors.password}
        type="password"
        autoComplete="current-password"
      />

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <i className="ri-loader-4-line animate-spin" aria-hidden="true" /> : 'Sign in'}
      </Button>

      <p className="text-center text-[14px] text-ink-secondary">
        New here?{' '}
        <Link href={AppRoute.SignUp} className="text-ink no-underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default SignInForm;
