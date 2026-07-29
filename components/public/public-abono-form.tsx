"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search, ArrowLeft, Building2, Hammer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, todayISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/types";
import {
  searchPayables,
  registerPublicAbono,
  type PayableHit,
} from "@/app/abono/actions";

const CONCEPT_SUGGESTIONS = ["Anticipo inicial", "Pago parcial", "Pago final", "Abono"];

export function PublicAbonoForm({ methods }: { methods: PaymentMethod[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PayableHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PayableHit | null>(null);

  const [concept, setConcept] = useState("Abono");
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const reqId = useRef(0);

  // Debounced search.
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
      const hits = await searchPayables(q);
      if (id === reqId.current) {
        setResults(hits);
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, selected]);

  const amountNum = Number(amount);
  const overBalance =
    selected?.pending != null && amountNum > 0 && amountNum > selected.pending + 0.001;

  function pick(hit: PayableHit) {
    setSelected(hit);
    setResults([]);
    setErrors({});
  }

  function back() {
    setSelected(null);
    setConcept("Abono");
    setAmount("");
    setMethodId("");
    setDate(todayISODate());
    setErrors({});
  }

  function submit() {
    setErrors({});
    if (!selected) return;
    if (overBalance) {
      setErrors({ amount: "Supera el saldo pendiente" });
      return;
    }
    startTransition(async () => {
      const res = await registerPublicAbono({
        kind: selected.kind,
        id: selected.id,
        amount: Number(amount),
        concept: concept.trim(),
        paymentMethodId: methodId,
        paymentDate: date,
      });
      if (res.ok) {
        toast.success("Abono registrado", {
          description: `${formatCurrency(Number(amount))} · ${selected.name}`,
        });
        // Navega en la misma pestaña al recibo para firmar e imprimir
        // (window.open tras await suele bloquearse como popup).
        window.location.assign(`/recibo/${res.receiptKind}/${res.receiptId}`);
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  // ── Step 1: search & pick ────────────────────────────────────────
  if (!selected) {
    return (
      <Card className="gap-0 p-5">
        <Label htmlFor="q" className="mb-2">
          Buscar obra o proyecto
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, cliente o domicilio…"
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
              key={`${hit.kind}-${hit.id}`}
              type="button"
              onClick={() => pick(hit)}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <span className="mt-0.5 text-muted-foreground">
                {hit.kind === "work" ? (
                  <Hammer className="size-4" />
                ) : (
                  <Building2 className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{hit.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {hit.kind === "work" ? "Obra" : "Proyecto"} · {hit.clientName}
                  {hit.address ? ` · ${hit.address}` : ""}
                </span>
              </span>
              {hit.pending != null && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  Por cobrar {formatCurrency(hit.pending)}
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>
    );
  }

  // ── Step 2: register abono ───────────────────────────────────────
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
        <p className="text-xs text-muted-foreground">
          {selected.kind === "work" ? "Obra" : "Proyecto"} · {selected.clientName}
          {selected.pending != null && ` · Por cobrar ${formatCurrency(selected.pending)}`}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="concept">Concepto</Label>
          <Input
            id="concept"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej. Pago parcial"
            aria-invalid={!!errors.concept}
          />
          <div className="flex flex-wrap gap-1.5">
            {CONCEPT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setConcept(s)}
                className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          {errors.concept && <p className="text-xs text-destructive">{errors.concept}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="amount">Monto</Label>
          <MoneyInput
            id="amount"
            value={amount}
            onValueChange={setAmount}
            placeholder="0.00"
            aria-invalid={!!errors.amount || overBalance}
          />
          {overBalance && (
            <p className="text-xs text-destructive">
              El abono supera el saldo pendiente ({formatCurrency(selected.pending!)}).
            </p>
          )}
          {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="method">Forma de pago</Label>
          <Select
            value={methodId}
            onValueChange={(v) => setMethodId(v ?? "")}
            items={methods.map((m) => ({ label: m.name, value: m.id }))}
          >
            <SelectTrigger id="method" className="w-full" aria-invalid={!!errors.paymentMethodId}>
              <SelectValue placeholder="Selecciona forma de pago" />
            </SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.paymentMethodId && (
            <p className="text-xs text-destructive">{errors.paymentMethodId}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="date">Fecha del pago</Label>
          <Input
            id="date"
            type="date"
            value={date}
            max={todayISODate()}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.paymentDate}
          />
          {errors.paymentDate && (
            <p className="text-xs text-destructive">{errors.paymentDate}</p>
          )}
        </div>

        <Button
          onClick={submit}
          disabled={isPending || overBalance}
          className={cn("mt-1 w-full")}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Registrar abono
        </Button>
      </div>
    </Card>
  );
}
