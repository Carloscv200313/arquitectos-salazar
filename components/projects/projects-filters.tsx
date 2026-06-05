"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";

export function ProjectsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [client, setClient] = useState(params.get("client") ?? "");

  const status = params.get("status") ?? "all";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const pushParams = useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      startTransition(() => {
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  // Debounce free-text inputs.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("search") ?? "") !== search) pushParams({ search });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("client") ?? "") !== client) pushParams({ client });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const hasFilters = !!(search || client || (status && status !== "all") || from || to);

  function clearAll() {
    setSearch("");
    setClient("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
      <div className="relative flex-1 lg:min-w-56">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar proyecto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="relative flex-1 lg:min-w-48">
        <Input
          placeholder="Cliente…"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        />
      </div>

      <Select
        value={status}
        onValueChange={(v) => pushParams({ status: !v || v === "all" ? "" : v })}
        items={[
          { label: "Todos los estados", value: "all" },
          { label: PAYMENT_STATUS_LABELS.pending, value: "pending" },
          { label: PAYMENT_STATUS_LABELS.partial, value: "partial" },
          { label: PAYMENT_STATUS_LABELS.paid, value: "paid" },
        ]}
      >
        <SelectTrigger className="lg:w-40">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="pending">{PAYMENT_STATUS_LABELS.pending}</SelectItem>
          <SelectItem value="partial">{PAYMENT_STATUS_LABELS.partial}</SelectItem>
          <SelectItem value="paid">{PAYMENT_STATUS_LABELS.paid}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label="Desde"
          value={from}
          onChange={(e) => pushParams({ from: e.target.value })}
          className="lg:w-40"
        />
        <span className="text-sm text-muted-foreground">—</span>
        <Input
          type="date"
          aria-label="Hasta"
          value={to}
          onChange={(e) => pushParams({ to: e.target.value })}
          className="lg:w-40"
        />
      </div>

      <div className="flex items-center gap-2">
        {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            <X className="size-4" /> Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
