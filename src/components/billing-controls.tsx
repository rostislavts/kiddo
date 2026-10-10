"use client";
import { useEffect, useRef, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { ArrowRight, CreditCard, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import { bg } from "@/i18n/bg";
import { Button } from "./ui/button";

export function BillingControls({
  hasSubscription,
  premium,
  configured,
}: {
  hasSubscription: boolean;
  premium: boolean;
  configured: boolean;
}) {
  const router = useRouter();
  const paddleRef = useRef<Paddle | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(premium);
  const [checkoutReady, setCheckoutReady] = useState(false);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    void initializePaddle({
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          setPending(true);
          setBusy(false);
        }
        if (event.name === "checkout.closed") setBusy(false);
        if (event.name === "checkout.error") {
          setError(bg.billing.checkoutError);
          setBusy(false);
        }
      },
    })
      .then((paddle) => {
        if (alive) {
          paddleRef.current = paddle;
          setCheckoutReady(!!paddle);
        }
      })
      .catch(() => {
        if (alive) setError(bg.billing.checkoutError);
      });
    return () => {
      alive = false;
    };
  }, [configured]);
  async function refresh() {
    try {
      const response = await fetch("/api/billing", { cache: "no-store" });
      if (!response.ok) return;
      const state = await response.json();
      if (state.premium) {
        setActive(true);
        setPending(false);
        router.refresh();
      }
    } catch {
      setError(bg.common.offline);
    }
  }
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 20) {
        clearInterval(timer);
        return;
      }
      void fetch("/api/billing", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const state = await response.json();
          if (state.premium) {
            setActive(true);
            setPending(false);
            clearInterval(timer);
            router.refresh();
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [pending, router]);
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      if (!paddleRef.current) throw new Error(bg.billing.checkoutError);
      const data = await postJson<{ transactionId: string }>("/api/billing", {
        action: "checkout",
      });
      paddleRef.current.Checkout.open({
        transactionId: data.transactionId,
        settings: { displayMode: "overlay", theme: "light", allowLogout: false },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : bg.billing.checkoutError);
      setBusy(false);
    }
  }
  async function portal() {
    setBusy(true);
    setError("");
    try {
      const data = await postJson<{ url: string }>("/api/billing", { action: "portal" });
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : bg.common.error);
      setBusy(false);
    }
  }
  return (
    <div className="form-stack">
      {!configured && <p className="notice">{bg.billing.unavailable}</p>}
      {active && (
        <p className="form-success" role="status">
          {bg.billing.activated}
        </p>
      )}
      {pending && (
        <div className="notice" role="status">
          <strong>{bg.billing.pendingTitle}</strong>
          <p>{bg.billing.pending}</p>
          <Button variant="ghost" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            {bg.billing.refresh}
          </Button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {hasSubscription ? (
        <Button disabled={busy || !configured} variant="secondary" onClick={() => void portal()}>
          <CreditCard size={17} />
          {bg.billing.manage}
        </Button>
      ) : (
        !active && (
          <Button
            disabled={busy || !configured || !checkoutReady || pending}
            onClick={() => void checkout()}
          >
            {bg.pricing.upgrade}
            <ArrowRight size={17} />
          </Button>
        )
      )}
      <p className="tiny-copy">{bg.pricing.secure}</p>
    </div>
  );
}
