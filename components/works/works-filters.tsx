"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORK_FILTER_STATUSES, WORK_STATUS_LABELS } from "@/lib/constants";

export function WorksFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [client, setClient] = useState(params.get("client") ?? "");
  const status = params.get("status") ?? "all";

  const pushParams = useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      startTransition(() => {
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if ((params.get("search") ?? "") !== search) pushParams({ search });
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if ((params.get("client") ?? "") !== client) pushParams({ client });
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const hasFilters = !!(search || client || (status && status !== "all"));

  function clearAll() {
    setSearch("");
    setClient("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
      <div className="relative flex-1 lg:min-w-56">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar obra..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>

      <div className="relative flex-1 lg:min-w-48">
        <Input
          placeholder="Cliente..."
          value={client}
          onChange={(event) => setClient(event.target.value)}
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) =>
          pushParams({ status: !value || value === "all" ? "" : value })
        }
        items={[
          { label: "Todos los estados", value: "all" },
          ...WORK_FILTER_STATUSES.map((item) => ({
            label: WORK_STATUS_LABELS[item],
            value: item,
          })),
        ]}
      >
        <SelectTrigger className="lg:w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {WORK_FILTER_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {WORK_STATUS_LABELS[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
