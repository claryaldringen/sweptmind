import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xl font-semibold tracking-tight">SweptMind</span>
      </Link>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
