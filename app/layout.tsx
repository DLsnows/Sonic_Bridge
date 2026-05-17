import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SonicBridge — Music Production Collaboration",
  description: "Real-time remote collaboration platform for music producers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#09090B] text-[#F0F0F0] font-['Fira_Code',monospace] antialiased">
        {children}
      </body>
    </html>
  );
}
