import type { Metadata, Viewport } from "next";
import { Mitr } from "next/font/google";
import "./globals.css";

const mitr = Mitr({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ดาวหางฮัลเลย์",
  description: "ฉากท้องฟ้ายามค่ำคืนกับดาวหางที่เต้นตามจังหวะเพลง",
};

export const viewport: Viewport = {
  themeColor: "#050816",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={mitr.className}>{children}</body>
    </html>
  );
}
