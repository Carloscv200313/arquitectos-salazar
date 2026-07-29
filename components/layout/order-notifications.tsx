"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ClipboardList, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const UNREAD_KEY = "arquitectos-salazar:public-order-notifications";
const UNSEEN_IDS_KEY = "arquitectos-salazar:public-order-notification-ids";

interface PublicOrderNotification {
  id: string;
  workId: string;
  workName: string;
  clientName: string;
  supplier: string;
  material: string;
  createdAt: string;
}

type NotificationStatus = "loading" | "live" | "fallback" | "error";

function trimText(value: string, max = 74) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function playBellSound() {
  const audioWindow = window as Window &
    typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.9);

  const playTone = (frequency: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.72,
      context.currentTime + start + duration,
    );
    oscillator.connect(gain);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + duration);
  };

  playTone(880, 0, 0.42);
  playTone(1320, 0.08, 0.5);

  window.setTimeout(() => {
    void context.close();
  }, 1100);
}

async function fetchPublicOrders(since?: string | null): Promise<PublicOrderNotification[]> {
  const url = since
    ? `/api/order-notifications?since=${encodeURIComponent(since)}`
    : "/api/order-notifications";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron leer las notificaciones.");
  const payload = (await response.json()) as { orders?: PublicOrderNotification[] };
  return payload.orders ?? [];
}

function storedUnseenIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const value = JSON.parse(window.localStorage.getItem(UNSEEN_IDS_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function OrderNotifications() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = Number(window.localStorage.getItem(UNREAD_KEY) ?? "0");
    return Number.isFinite(stored) ? stored : 0;
  });
  const [unseenIds, setUnseenIds] = useState<Set<string>>(() => storedUnseenIds());
  const [status, setStatus] = useState<NotificationStatus>("loading");
  const [orders, setOrders] = useState<PublicOrderNotification[]>([]);
  const latestSeenRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  const supabase = useMemo(() => {
    if (!isSupabaseConfigured()) return null;
    return createClient();
  }, []);

  useEffect(() => {
    let active = true;

    function registerIncoming(order: PublicOrderNotification, notify: boolean) {
      setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)].slice(0, 5));
      if (!notify) return;
      setUnread((current) => {
        const value = current + 1;
        window.localStorage.setItem(UNREAD_KEY, String(value));
        return value;
      });
      setUnseenIds((current) => {
        const next = new Set(current);
        next.add(order.id);
        window.localStorage.setItem(UNSEEN_IDS_KEY, JSON.stringify(Array.from(next)));
        return next;
      });
      toast.info("Nuevo pedido solicitado", {
        description: `${order.workName} · ${trimText(order.material, 52)}`,
      });
      try {
        playBellSound();
      } catch {
        // Browsers can block audio before user interaction; the visual toast remains.
      }
    }

    async function loadRecent() {
      try {
        const nextOrders = await fetchPublicOrders();
        if (!active) return;
        setOrders(nextOrders);
        setStatus((current) => (current === "live" ? "live" : "fallback"));
        if (!latestSeenRef.current && nextOrders[0]) {
          latestSeenRef.current = nextOrders[0].createdAt;
        }
        hydratedRef.current = true;
      } catch {
        if (active) setStatus("error");
      }
    }

    async function pollNewOrders() {
      if (!hydratedRef.current) return;
      const since = latestSeenRef.current;
      try {
        const incoming = await fetchPublicOrders(since);
        if (!active) return;
        setStatus((current) => (current === "live" ? "live" : "fallback"));
        if (!incoming.length) return;
        for (const order of incoming) {
          registerIncoming(order, true);
          latestSeenRef.current = order.createdAt;
        }
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadRecent();
    const pollId = window.setInterval(() => {
      void pollNewOrders();
    }, 15000);

    const channel = supabase
      ?.channel("public-work-order-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "work_orders",
          filter: "source=eq.public",
        },
        async (payload) => {
          const id = String(payload.new.id ?? "");
          if (!id) return;
          void pollNewOrders();
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") setStatus("live");
      });

    return () => {
      active = false;
      window.clearInterval(pollId);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [supabase]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setUnread(0);
      window.localStorage.setItem(UNREAD_KEY, "0");
      return;
    }

    if (unseenIds.size > 0) {
      setUnseenIds(new Set());
      window.localStorage.setItem(UNSEEN_IDS_KEY, "[]");
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={<Button variant="outline" size="icon" className="relative rounded-full" />}>
        <Bell className="size-4" />
        <span className="sr-only">Notificaciones de pedidos</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-brand-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <PopoverHeader className="border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <PopoverTitle>Pedidos públicos</PopoverTitle>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                status === "live"
                  ? "bg-success/15 text-success-foreground"
                  : status === "error"
                    ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {status === "live" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
              {status === "live" ? "En vivo" : status === "error" ? "Error" : "Revisando"}
            </span>
          </div>
        </PopoverHeader>

        <div className="max-h-96 overflow-y-auto">
          {orders.length ? (
            orders.map((order) => {
              const pending = unseenIds.has(order.id);
              return (
              <Link
                key={order.id}
                href={`/pedidos/${order.workId}`}
                className={cn(
                  "flex gap-3 border-b p-4 transition-colors last:border-b-0",
                  pending
                    ? "bg-brand-muted/45 hover:bg-brand-muted/65"
                    : "bg-card hover:bg-muted/50",
                )}
                onClick={() => setOpen(false)}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-brand-foreground",
                    pending ? "bg-brand/25" : "bg-brand-muted",
                  )}
                >
                  <ClipboardList className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{order.workName}</span>
                  <span className="block text-xs text-muted-foreground">{order.clientName}</span>
                  <span className="mt-1 block text-sm">{trimText(order.material)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {order.supplier} · {formatDateTime(order.createdAt)}
                  </span>
                </span>
              </Link>
              );
            })
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aún no hay solicitudes públicas recientes.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
