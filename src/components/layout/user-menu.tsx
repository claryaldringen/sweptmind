"use client";

import { useId } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

export function UserMenu() {
  const triggerId = useId();
  const { data: session } = useSession();
  const { t } = useTranslations();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={triggerId}
        className="hover:bg-sidebar-accent flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={session?.user?.image ?? undefined} />
          <AvatarFallback className="text-xs">
            {initials ?? <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{session?.user?.name ?? t("common.user")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{session?.user?.name}</p>
          <p className="text-muted-foreground text-xs">{session?.user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            {t("sidebar.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("common.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
