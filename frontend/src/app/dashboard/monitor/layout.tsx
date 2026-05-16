import { redirect } from 'next/navigation';
import { cookies }  from 'next/headers';

// Comma-separated list of emails allowed to access the monitor page
const ALLOWED_EMAILS = (process.env.MONITOR_ADMIN_EMAIL ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function getEmailFromCookie(): string | null {
  try {
    const cookieStore = cookies();
    const raw = cookieStore.get('sb-qlpxwpajrhwbvecuqpzj-auth-token')?.value;
    if (!raw) return null;
    const session = JSON.parse(raw);
    const token = session?.access_token;
    if (!token) return null;
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return payload?.email ?? null;
  } catch {
    return null;
  }
}

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

  if (!testMode) {
    const email = getEmailFromCookie();
    if (!email || !ALLOWED_EMAILS.includes(email.toLowerCase())) {
      redirect('/dashboard');
    }
  }

  return <>{children}</>;
}
