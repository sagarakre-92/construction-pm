import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Construction PM — Project Management",
  description: "Construction project management for teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
