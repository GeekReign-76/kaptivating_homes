import type { Metadata } from 'next';
import { Suspense }      from 'react';
import { RegisterForm }  from '@/components/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create Account' };

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-neutral-900">
            Create Your Account
          </h1>
          <p className="mt-2 text-neutral-500">
            Save searches, message directly, and book appointments.
          </p>
        </div>
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
