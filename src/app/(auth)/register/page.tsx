import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a free SweptMind account and start organizing your tasks.",
  robots: { index: true, follow: true },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
