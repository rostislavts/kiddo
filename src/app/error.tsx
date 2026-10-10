"use client";
import { bg } from "@/i18n/bg";
import { Button } from "@/components/ui/button";
import { Robot } from "@/components/illustration";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="container gate">
      <div className="auth-art">
        <Robot />
      </div>
      <h1>{bg.errors.title}</h1>
      <p className="muted">{bg.errors.description}</p>
      <Button onClick={reset}>{bg.common.retry}</Button>
    </main>
  );
}
