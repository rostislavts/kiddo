"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  ChartNoAxesCombined,
  Award,
  ArrowLeftRight,
  ShieldCheck,
  Users,
  CreditCard,
  Settings,
  LogOut,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Brand } from "./brand";
import { bg, avatars, type AvatarKey } from "@/i18n/bg";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";
export function AppShell({
  children,
  mode = "child",
  nickname,
  avatar = "robot",
  admin = false,
}: {
  children: React.ReactNode;
  mode?: "child" | "parent" | "admin" | "school";
  nickname?: string;
  avatar?: string;
  admin?: boolean;
}) {
  const pathname = usePathname();
  const links =
    mode === "child"
      ? [
          { href: "/app", label: "УЧИ · AI Academy", Icon: Map },
          { href: "/app/lab", label: "СЪЗДАВАЙ · AI Lab", Icon: Sparkles },
          { href: "/app/missions", label: "ИГРАЙ · AI Missions", Icon: Award },
          { href: "/app/creations", label: "Моите творби", Icon: Sparkles },
          { href: "/app/progress", label: bg.nav.progress, Icon: ChartNoAxesCombined },
          { href: "/app/achievements", label: bg.nav.achievements, Icon: Award },
        ]
      : mode === "parent"
        ? [
            { href: "/parent", label: bg.nav.parent, Icon: ChartNoAxesCombined },
            { href: "/parent/children", label: bg.nav.children, Icon: Users },
            { href: "/parent/billing", label: bg.nav.billing, Icon: CreditCard },
            { href: "/parent/school", label: "Училище и Energy", Icon: Users },
            { href: "/parent/settings", label: bg.nav.settings, Icon: Settings },
          ]
        : mode === "school"
          ? [
              { href: "/school", label: "Моите училища", Icon: Users },
              { href: "/parent", label: "Личен акаунт", Icon: ShieldCheck },
            ]
          : [
              { href: "/admin", label: bg.nav.admin, Icon: Settings },
              { href: "/admin/worlds", label: bg.admin.worlds, Icon: Map },
              { href: "/admin/lab", label: "AI Lab и мисии", Icon: Sparkles },
              { href: "/admin/schools", label: "Училища и лицензи", Icon: Users },
            ];
  return (
    <div className="application">
      <aside className="sidebar">
        <Brand href={mode === "child" ? "/app" : "/"} />
        <div className="sidebar-section">
          {mode === "child"
            ? bg.dashboard.adventure
            : mode === "parent"
              ? bg.parent.eyebrow
              : mode === "school"
                ? "Училищен панел"
                : bg.admin.title}
        </div>
        <nav className="side-nav">
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "nav-item",
                (pathname === href ||
                  (href !== "/app" &&
                    href !== "/parent" &&
                    href !== "/admin" &&
                    pathname.startsWith(`${href}/`))) &&
                  "active",
              )}
            >
              <Icon size={21} />
              {label}
            </Link>
          ))}
        </nav>
        {mode === "child" && (
          <div className="sidebar-note">
            <Sparkles size={23} />
            <strong>{bg.dashboard.tipTitle}</strong>
            <p>{bg.dashboard.tipText}</p>
          </div>
        )}
        <div className="sidebar-bottom">
          {mode !== "school" && mode !== "child" && (
            <Link className="nav-item" href="/school">
              <Users size={19} />
              Училищен панел
            </Link>
          )}
          {mode === "child" ? (
            <>
              <Link className="nav-item" href="/select-child">
                <ArrowLeftRight size={19} />
                {bg.nav.switch}
              </Link>
              <Link className="nav-item" href="/parent">
                <ShieldCheck size={19} />
                {bg.nav.parent}
              </Link>
            </>
          ) : (
            <Link className="nav-item" href="/app">
              <ArrowLeft size={19} />
              {bg.nav.map}
            </Link>
          )}
          {admin && mode !== "admin" && (
            <Link className="nav-item" href="/admin">
              <Settings size={19} />
              {bg.nav.admin}
            </Link>
          )}
          <form action={signOut}>
            <button className="nav-item">
              <LogOut size={18} />
              {bg.nav.logout}
            </button>
          </form>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <span className="topbar-label">{bg.tagline}</span>
          <div className="topbar-controls">
            <Link href="/select-child" className="profile-chip">
              <span className="avatar-small">{avatars[avatar as AvatarKey] || avatars.robot}</span>
              {nickname || bg.parent.account}
            </Link>
            <Link
              href={mode === "child" ? "/parent" : "/app"}
              className="icon-button mobile-only"
              aria-label={mode === "child" ? bg.nav.parent : bg.nav.map}
            >
              <ShieldCheck size={17} />
            </Link>
            <form action={signOut} className="mobile-only">
              <button className="icon-button" aria-label={bg.nav.logout}>
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <main className="app-main" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
