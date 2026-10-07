import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
        <Link href="/" className="flex items-baseline gap-1">
          <span className="text-lg font-black text-brand">SK</span>
          <span className="text-lg font-black text-brand-2">AX</span>
          <span className="ml-2 text-sm font-bold">AICT 연습</span>
        </Link>
        <nav className="ml-auto flex gap-5 text-sm">
          <Link href="/" className="text-muted hover:text-ink">홈</Link>
          <Link href="/generate" className="text-muted hover:text-ink">문제 생성</Link>
          <Link href="/history" className="text-muted hover:text-ink">기록</Link>
          <Link href="/settings" className="text-muted hover:text-ink">설정</Link>
        </nav>
      </div>
    </header>
  );
}
