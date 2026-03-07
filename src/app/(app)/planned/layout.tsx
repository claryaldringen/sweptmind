import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plánované",
  description: "Přehled naplánovaných úkolů podle data splnění.",
};

export default function PlannedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
