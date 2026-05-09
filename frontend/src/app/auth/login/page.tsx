import type { Metadata } from 'next';
import { LoginForm }    from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-neutral-900">
            {process.env.NEXT_PUBLIC_SITE_NAME ?? 'Kaptivating Homes'}
          </h1>
          <p className="mt-2 text-neutral-500">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
