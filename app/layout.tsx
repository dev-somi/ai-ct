import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AICT 연습",
  description: "SK AI 실무역량검사(AICT) 연습용 로컬 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
