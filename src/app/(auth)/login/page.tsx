import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your SweptMind account.",
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return <LoginForm />;
}
