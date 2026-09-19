import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Orbits } from "@/components/Shapes";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-5 py-14 lg:flex-row lg:gap-20">
      <div className="relative hidden aspect-square w-full max-w-sm lg:block">
        <Orbits className="inset-[-8%]" />
        <div className="absolute inset-0 overflow-hidden rounded-full border border-white/10">
          <Image
            src="/images/rings-circle.jpg"
            alt=""
            width={800}
            height={800}
            className="h-full w-full object-cover opacity-85"
          />
        </div>
        <div className="pill absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5">
          <span className="mono text-[0.65rem] text-muted">detect · confirm · restore</span>
        </div>
      </div>

      <div className="w-full max-w-sm rise">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/15">
            <span className="h-2 w-2 rounded-full bg-white/80" />
          </span>
          <span className="text-sm tracking-tight">Duplex</span>
        </Link>
        <h1 className="text-2xl tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 mb-7 text-xs leading-relaxed text-muted">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
