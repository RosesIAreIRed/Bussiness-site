import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ormilo Growth OS',
  description:
    'Внутрішня платформа автоматизації Shopify-дропшипінгу: research, креативи, публікація, замовлення та аналітика.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
