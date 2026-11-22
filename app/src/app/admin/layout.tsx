import { Geist_Mono, Onest } from "next/font/google";
import "../globals.css";

const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], weight: ["500", "700"], variable: "--font-mono", display: "swap" });

export const metadata = { title: "Administrácia", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={`${onest.variable} ${mono.variable}`}>
      <body><div className="app">{children}</div></body>
    </html>
  );
}
