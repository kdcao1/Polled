import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  headers: string[];
  minWidth?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export default function AdminTable({
  title,
  description,
  headers,
  minWidth = '800px',
  footer,
  children,
}: Props) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">{title}</h3>
      <p className="mb-4 text-xs text-gray-400">{description}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-gray-100 text-left uppercase tracking-wide text-gray-400">
              {headers.map((header, index) => (
                <th key={header} className={`pb-2 ${index === headers.length - 1 ? 'text-right' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
