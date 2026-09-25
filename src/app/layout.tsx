import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "The Dog Club · A place for your pack",
  description: "Your club. Their happy place.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
