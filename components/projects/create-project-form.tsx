"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Users, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { todayISODate } from "@/lib/format";
import type { Client, PaymentMethod } from "@/lib/types";
import { DistributionPreview } from "./distribution-preview";
import { createProjectAction } from "@/app/(dashboard)/projects/actions";

type ClientMode = "existing" | "new";
interface AddonRow {
  id: string;
  concept: string;
  amount: string;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

function newAddon(): AddonRow {
  return { id: crypto.randomUUID(), concept: "", amount: "" };
}

export function CreateProjectForm({
  clients,
  methods,
}: {
  clients: Client[];
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [clientMode, setClientMode] = useState<ClientMode>(
    clients.length > 0 ? "existing" : "new",
  );
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectAmount, setProjectAmount] = useState("");
  const [addons, setAddons] = useState<AddonRow[]>([]);

  const [registerAnticipo, setRegisterAnticipo] = useState(false);
  const [anticipoAmount, setAnticipoAmount] = useState("");
  const [anticipoConcept, setAnticipoConcept] = useState("Anticipo inicial");
  const [anticipoMethodId, setAnticipoMethodId] = useState("");
  const [anticipoDate, setAnticipoDate] = useState(todayISODate());

  const base = Number(projectAmount);
  const parsedAddons = addons.map((a) => ({
    concept: a.concept,
    amount: Number(a.amount) || 0,
  }));

  function updateAddon(id: string, patch: Partial<AddonRow>) {
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeAddon(id: string) {
    setAddons((prev) => prev.filter((a) => a.id !== id));
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const res = await createProjectAction({
        name: name.trim(),
        clientId: clientMode === "existing" ? clientId : "",
        clientName: clientMode === "new" ? clientName.trim() : "",
        projectAmount: Number(projectAmount),
        addons: parsedAddons
          .filter((a) => a.amount > 0)
          .map((a) => ({ concept: a.concept.trim(), amount: a.amount })),
        registerAnticipo,
        anticipoAmount: registerAnticipo ? Number(anticipoAmount) : undefined,
        anticipoConcept: registerAnticipo ? anticipoConcept.trim() : undefined,
        anticipoMethodId: registerAnticipo ? anticipoMethodId : undefined,
        anticipoDate: registerAnticipo ? anticipoDate : undefined,
      });
      if (res.ok) {
        toast.success("Proyecto creado", { description: name.trim() });
        router.push(`/projects/${res.data.projectId}`);
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      {/* ── Left: form ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <Card className="gap-0 py-0">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Datos del proyecto</h2>
            <p className="text-xs text-muted-foreground">
              Información principal y cliente asociado.
            </p>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nombre del proyecto</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Casa de Playa Asia"
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name}</FieldError>
            </div>

            <div className="grid gap-1.5">
              <Label>Cliente</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode("existing")}
                  disabled={clients.length === 0}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                    clientMode === "existing"
                      ? "border-brand bg-brand-muted text-brand-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <Users className="size-4" /> Existente
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("new")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    clientMode === "new"
                      ? "border-brand bg-brand-muted text-brand-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <UserPlus className="size-4" /> Nuevo
                </button>
              </div>

              {clientMode === "existing" ? (
                <Select
                  value={clientId}
                  onValueChange={(v) => setClientId(v ?? "")}
                  items={clients.map((c) => ({ label: c.name, value: c.id }))}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.clientId}>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre del nuevo cliente"
                  aria-invalid={!!errors.clientName || !!errors.clientId}
                />
              )}
              <FieldError>{errors.clientId || errors.clientName}</FieldError>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="base">Monto del proyecto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="base"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={projectAmount}
                  onChange={(e) => setProjectAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 text-base font-medium"
                  aria-invalid={!!errors.projectAmount}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este es el monto base que se le cobra al cliente antes de sumar adicionales.
              </p>
              <FieldError>{errors.projectAmount}</FieldError>
            </div>
          </div>
        </Card>

        {/* ── Adicionales ─────────────────────────────────────── */}
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Adicionales</h2>
              <p className="text-xs text-muted-foreground">
                Montos extra (levantamiento, etc.). Se suman al total sin porcentajes.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddons((prev) => [...prev, newAddon()])}
            >
              <Plus className="size-4" /> Agregar
            </Button>
          </div>

          <div className="p-5">
            {addons.length === 0 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-3 text-center text-xs text-muted-foreground">
                Sin adicionales. Agrega uno si el cliente solicita un extra.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {addons.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Input
                      value={a.concept}
                      onChange={(e) => updateAddon(a.id, { concept: e.target.value })}
                      placeholder="Concepto (ej. Levantamiento)"
                      className="flex-1"
                    />
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={a.amount}
                        onChange={(e) => updateAddon(a.id, { amount: e.target.value })}
                        placeholder="0.00"
                        className="pl-6"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAddon(a.id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Quitar adicional</span>
                    </Button>
                  </div>
                ))}
                <FieldError>{errors.addons}</FieldError>
              </div>
            )}
          </div>
        </Card>

        {/* ── Anticipo ────────────────────────────────────────── */}
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Anticipo inicial</h2>
              <p className="text-xs text-muted-foreground">
                Registra un primer ingreso al crear el proyecto (opcional).
              </p>
            </div>
            <Switch
              checked={registerAnticipo}
              onCheckedChange={setRegisterAnticipo}
              aria-label="Registrar anticipo inicial"
            />
          </div>

          {registerAnticipo && (
            <div className="grid gap-4 border-t p-5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ant-amount">Monto del anticipo</Label>
                <Input
                  id="ant-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={anticipoAmount}
                  onChange={(e) => setAnticipoAmount(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={!!errors.anticipoAmount}
                />
                <FieldError>{errors.anticipoAmount}</FieldError>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ant-date">Fecha</Label>
                <Input
                  id="ant-date"
                  type="date"
                  value={anticipoDate}
                  max={todayISODate()}
                  onChange={(e) => setAnticipoDate(e.target.value)}
                  aria-invalid={!!errors.anticipoDate}
                />
                <FieldError>{errors.anticipoDate}</FieldError>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ant-concept">Concepto</Label>
                <Input
                  id="ant-concept"
                  value={anticipoConcept}
                  onChange={(e) => setAnticipoConcept(e.target.value)}
                  placeholder="Anticipo inicial"
                  aria-invalid={!!errors.anticipoConcept}
                />
                <FieldError>{errors.anticipoConcept}</FieldError>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ant-method">Forma de pago</Label>
                <Select
                  value={anticipoMethodId}
                  onValueChange={(v) => setAnticipoMethodId(v ?? "")}
                  items={methods.map((m) => ({ label: m.name, value: m.id }))}
                >
                  <SelectTrigger
                    id="ant-method"
                    className="w-full"
                    aria-invalid={!!errors.anticipoMethodId}
                  >
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
                <FieldError>{errors.anticipoMethodId}</FieldError>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Right: summary + actions ─────────────────────────────── */}
      <div className="lg:sticky lg:top-24">
        <Card className="gap-0 py-0">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <p className="text-xs text-muted-foreground">Cálculo automático del total.</p>
          </div>
          <div className="p-5">
            <DistributionPreview base={base} addons={parsedAddons} />
          </div>
          <div className="flex flex-col gap-2 border-t p-5">
            <Button onClick={submit} disabled={isPending} className="w-full">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Crear proyecto
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/projects")}
              disabled={isPending}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
