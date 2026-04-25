import Link from 'next/link';
import { isAdminLoginEnabled } from '@/lib/admin-auth';

type Props = {
  children: React.ReactNode;
  active: 'analytics' | 'controls';
  sourceLabel?: string;
};

const navItems = [
  { href: '/', label: 'Analytics', key: 'analytics' },
  { href: '/controls', label: 'Controls', key: 'controls' },
] as const;

export default function AdminShell({ children, active, sourceLabel }: Props) {
  return (
    <main className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Polled Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              {sourceLabel ? `${sourceLabel} | ` : ''}{new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    active === item.key
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {isAdminLoginEnabled() && (
              <form action="/api/admin/logout" method="post">
                <button className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 shadow-sm">
                  Sign Out
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      {children}
    </main>
  );
}
