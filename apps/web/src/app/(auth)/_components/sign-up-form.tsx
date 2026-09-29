'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { RegisterConflictErrorSchema, RegisterSchema, type RegisterInput } from '@insula/contracts';
import { Button, Field, useGuardedSubmit, useZodForm } from '@insula/ui';
import { extractErrorMessage, isApiClientError, register } from '@insula/web-auth';

import { AppRoute } from '../../../lib/routes';

export function SignUpForm() {
  const router = useRouter();
  const form = useZodForm(RegisterSchema);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(
    useGuardedSubmit(async (values: RegisterInput) => {
      try {
        await register(values);
        router.replace(AppRoute.Home);
      } catch (err) {
        if (isApiClientError(err) && err.kind === 'http' && err.status === 409) {
          const parsed = RegisterConflictErrorSchema.safeParse(err.body);
          if (parsed.success) {
            setError(parsed.data.field, { type: 'server', message: parsed.data.message });
            return;
          }
        }
        setError('root', { message: extractErrorMessage(err) });
      }
    }),
  );

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <div>
        <div className="text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink">
          Create your account
        </div>
        <p className="mt-1 text-[15px] leading-[1.6] text-ink-secondary">You can make agents once you&apos;re in.</p>
      </div>

      <Button type="button" variant="secondary" size="md" className="w-full flex items-center justify-center gap-2.5">
        <i className="ri-google-fill text-[18px] text-ink" aria-hidden="true" />
        Sign up with Google
      </Button>

      <div className="flex items-center gap-3 text-[13px] text-ink-muted">
        <div className="h-px flex-1 bg-line" />
        or with email
        <div className="h-px flex-1 bg-line" />
      </div>

      {errors.root?.message ? (
        <p className="rounded-input bg-[#F8E9E6] px-3 py-2 text-[13px] text-danger">{errors.root.message}</p>
      ) : null}

      <Field<RegisterInput>
        label="Display name"
        name="displayName"
        register={registerField}
        error={errors.displayName}
        autoComplete="name"
      />
      <Field<RegisterInput> label="Email" name="email" register={registerField} error={errors.email} type="email" autoComplete="email" />
      <Field<RegisterInput>
        label="Handle"
        name="handle"
        register={registerField}
        error={errors.handle}
        autoComplete="username"
      />
      <Field<RegisterInput>
        label="Password"
        name="password"
        register={registerField}
        error={errors.password}
        type="password"
        autoComplete="new-password"
      />

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <i className="ri-loader-4-line animate-spin" aria-hidden="true" /> : 'Create account'}
      </Button>

      <p className="text-center text-[14px] text-ink-secondary">
        Already on Insula?{' '}
        <Link href={AppRoute.SignIn} className="text-ink no-underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default SignUpForm;
