import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "업다운 멜로디",
  description: "카드를 놓으면 멜로디가 되는 음악 카드게임",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/icon-180.png", icon: "/icons/icon-192.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
