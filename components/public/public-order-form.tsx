"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search, ArrowLeft, Hammer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayISODate } from "@/lib/format";
import {
  searchWorks,
  registerPublicOrder,
  type WorkHit,
} from "@/app/pedido/actions";

export function PublicOrderForm({ providers }: { providers: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<WorkHit | null>(null);

  const [orderDate, setOrderDate] = useState(todayISODate());
  const [supplier, setSupplier] = useState("");
  const [material, setMaterial] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const reqId = useRef(0);

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const hits = await searchWorks(q);
      if (id === reqId.current) {
        setResults(hits);
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, selected]);

  function pick(hit: WorkHit) {
    setSelected(hit);
    setResults([]);
    setErrors({});
  }

  function back() {
    setSelected(null);
    setOrderDate(todayISODate());
    setSupplier("");
    setMaterial("");
    setDescription("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    if (!selected) return;
    startTransition(async () => {
      const res = await registerPublicOrder({
        workId: selected.id,
        orderDate,
        supplier,
        material: material.trim(),
        description: description.trim(),
      });
      if (res.ok) {
        toast.success("Pedido registrado", {
          description: `${selected.name} · ${material.trim()}`,
        });
        setQuery("");
        back();
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  // ── Step 1: search & pick obra ───────────────────────────────────
  if (!selected) {
    return (
      <Card className="gap-0 p-5">
        <Label htmlFor="q" className="mb-2">
          Buscar obra
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre de la obra o cliente…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {searching && (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando…
            </p>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {results.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => pick(hit)}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <span className="mt-0.5 text-muted-foreground">
                <Hammer className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{hit.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Obra · {hit.clientName}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  // ── Step 2: register pedido ──────────────────────────────────────
  return (
    <Card className="gap-0 p-5">
      <button
        type="button"
        onClick={back}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Buscar otra
      </button>

      <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2.5">
        <p className="text-sm font-medium">{selected.name}</p>
        <p className="text-xs text-muted-foreground">Obra · {selected.clientName}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="order-date">Fecha del pedido</Label>
          <Input
            id="order-date"
            type="date"
            value={orderDate}
            max={todayISODate()}
            onChange={(e) => setOrderDate(e.target.value)}
            aria-invalid={!!errors.orderDate}
          />
          {errors.orderDate && <p className="text-xs text-destructive">{errors.orderDate}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="order-supplier">Proveedor</Label>
          <Select
            value={supplier}
            onValueChange={(v) => setSupplier(v ?? "")}
            items={providers.map((p) => ({ label: p, value: p }))}
          >
            <SelectTrigger id="order-supplier" className="w-full" aria-invalid={!!errors.supplier}>
              <SelectValue placeholder="Selecciona proveedor" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.supplier && <p className="text-xs text-destructive">{errors.supplier}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="order-material">Material</Label>
          <Textarea
            id="order-material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Describe todos los materiales del pedido."
            rows={4}
            maxLength={1000}
            aria-invalid={!!errors.material}
          />
          <div className="flex items-center justify-between">
            {errors.material ? (
              <p className="text-xs text-destructive">{errors.material}</p>
            ) : (
              <span className="text-xs text-muted-foreground">
                Describe todos los materiales del pedido.
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {material.length}/1000
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="order-description">Observación</Label>
          <Textarea
            id="order-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
            rows={2}
            maxLength={500}
            aria-invalid={!!errors.description}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description}</p>
          )}
        </div>

        <Button onClick={submit} disabled={isPending} className="mt-1 w-full">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Registrar pedido
        </Button>
      </div>
    </Card>
  );
}
