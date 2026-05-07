import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/context/AuthContext";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "UOTD — Ulam Of The Day",
    template: "%s | UOTD",
  },
  description:
    "Anong ulam ngayon? Filipino meal planner: generate ulam from your pantry, plan your week, search recipes, and stay within budget.",
  keywords: ["ulam", "Filipino food", "meal planner", "recipe", "lutong bahay"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fil">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-cream text-brand-bark font-body">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
