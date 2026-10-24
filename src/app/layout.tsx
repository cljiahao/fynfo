import { Providers, ThemeProvider } from '@/components/layout';
import type { Metadata } from 'next';
import { Geist_Mono, Lato } from 'next/font/google';
import { headers } from 'next/headers';
import { Toaster } from 'sonner';
import './globals.css';

const lato = Lato({
  variable: '--font-lato',
  subsets: ['latin'],
  weight: ['100', '300', '400', '700', '900'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Fynfo',
  description:
    'Personal finance tracker - track your assets, salary, expenses, and equity',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning className="no-scrollbar">
      <body
        className={`${lato.variable} ${geistMono.variable} relative antialiased`}
      >
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
