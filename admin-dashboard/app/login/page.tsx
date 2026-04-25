import { redirect } from 'next/navigation';
import { isAdminAuthenticated, isAdminLoginEnabled } from '@/lib/admin-auth';

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  if (!isAdminLoginEnabled()) redirect('/');
  if (isAdminAuthenticated()) redirect('/');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action="/api/admin/login" method="post" className="w-full max-w-sm rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
        <p className="mt-1 text-sm text-gray-500">Enter the admin secret to manage Polled.</p>
        {searchParams?.error && (
          <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            Incorrect admin secret.
          </p>
        )}
        <label className="mt-5 block text-sm font-medium text-gray-700" htmlFor="password">
          Admin secret
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900"
          required
        />
        <button className="mt-5 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Sign In
        </button>
      </form>
    </main>
  );
}
