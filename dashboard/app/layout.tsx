import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EventReels — E2E Dashboard",
  description: "UI Automation Test Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
