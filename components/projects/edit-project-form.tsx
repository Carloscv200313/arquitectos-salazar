"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Users, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  RESPONSIBLE_OPTIONS,
  PROJECT_SLICE_LABELS,
  PROYECTO_RATE,
  type SliceWeights,
} from "@/lib/constants";
import type { Client, InternalArea, ProjectResponsible, ProjectWithFinance } from "@/lib/types";
import { weightsFromAmounts, computeBreakdown, round2 } from "@/lib/calculations";
import { DistributionPreview } from "./distribution-preview";
import { updateProjectAction } from "@/app/(dashboard)/projects/actions";

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

const SLICE_KEYS = Object.keys(PROJECT_SLICE_LABELS) as InternalArea[];

export function EditProjectForm({
  project,
  clients,
  paidByArea,
}: {
  project: ProjectWithFinance;
  clients: Client[];
  paidByArea: Record<InternalArea, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address ?? "");
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [clientId, setClientId] = useState(project.client_id);
  const [clientName, setClientName] = useState("");
  const [projectAmount, setProjectAmount] = useState(String(project.project_amount));
  const [responsibles, setResponsibles] = useState<Record<InternalArea, ProjectResponsible>>({
    proposal: project.proposal_responsible,
    modeling_3d: project.modeling_3d_responsible,
    plans: project.plans_responsible,
    render: project.render_responsible,
  });
  const [addons, setAddons] = useState<AddonRow[]>(
    project.addons.map((a) => ({
      id: a.id,
      concept: a.concept,
      amount: String(a.amount),
    })),
  );

  const initialWeights = weightsFromAmounts({
    proposal: project.proposal_amount,
    modeling_3d: project.modeling_3d_amount,
    plans: project.plans_amount,
    render: project.render_amount,
  });
  const [weightInputs, setWeightInputs] = useState<Record<InternalArea, string>>({
    proposal: String(round2(initialWeights.proposal * 100)),
    modeling_3d: String(round2(initialWeights.modeling_3d * 100)),
    plans: String(round2(initialWeights.plans * 100)),
    render: String(round2(initialWeights.render * 100)),
  });

  const base = Number(projectAmount);
  const parsedAddons = addons.map((a) => ({
    concept: a.concept,
    amount: Number(a.amount) || 0,
  }));

  const weightSum = SLICE_KEYS.reduce((s, k) => s + (Number(weightInputs[k]) || 0), 0);
  const weightsValid = Math.abs(weightSum - 100) < 0.5;
  const weights: SliceWeights = {
    proposal: (Number(weightInputs.proposal) || 0) / 100,
    modeling_3d: (Number(weightInputs.modeling_3d) || 0) / 100,
    plans: (Number(weightInputs.plans) || 0) / 100,
    render: (Number(weightInputs.render) || 0) / 100,
  };
  // New amount per area = portion (50% of base) split by the edited weights.
  const areaAmounts = computeBreakdown(base || 0, [], weights).project;
  // An area cannot drop below what was already paid (spent) in it.
  const areaErrors = SLICE_KEYS.filter(
    (k) => areaAmounts[k] < paidByArea[k] - 0.001,
  );
  const hasAreaError = areaErrors.length > 0;

  function updateAddon(id: string, patch: Partial<AddonRow>) {
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeAddon(id: string) {
    setAddons((prev) => prev.filter((a) => a.id !== id));
  }
  function addRow() {
    setAddons((prev) => [...prev, { id: crypto.randomUUID(), concept: "", amount: "" }]);
  }

  function submit() {
    setErrors({});
    if (!weightsValid) {
      setErrors({ weights: "Los porcentajes deben sumar 100%" });
      return;
    }
    if (hasAreaError) {
      const k = areaErrors[0];
      setErrors({
        weights: `${PROJECT_SLICE_LABELS[k]}: el monto (${areaAmounts[k].toFixed(2)}) queda menor que lo ya pagado (${paidByArea[k].toFixed(2)})`,
      });
      return;
    }
    startTransition(async () => {
      const res = await updateProjectAction({
        id: project.id,
        name: name.trim(),
        address: address.trim(),
        clientId: clientMode === "existing" ? clientId : "",
        clientName: clientMode === "new" ? clientName.trim() : "",
        responsibles,
        weights,
        projectAmount: Number(projectAmount),
        addons: parsedAddons
          .filter((a) => a.amount > 0)
          .map((a) => ({ concept: a.concept.trim(), amount: a.amount })),
      });
      if (res.ok) {
        toast.success("Proyecto actualizado", { description: name.trim() });
        router.push(`/projects/${project.id}`);
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div className="flex flex-col gap-5">
        <Card className="gap-0 py-0">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Editar proyecto</h2>
            <p className="text-xs text-muted-foreground">
              Ya cobrado: {formatCurrency(project.finance.income)}. El total resultante no
              puede ser menor.
            </p>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nombre del proyecto</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name}</FieldError>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="address">Domicilio</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Av. Los Pinos 123, Asia"
                aria-invalid={!!errors.address}
              />
              <FieldError>{errors.address}</FieldError>
            </div>

            <div className="grid gap-1.5">
              <Label>Cliente</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode("existing")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
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
                  className="pl-7 text-base font-medium"
                  aria-invalid={!!errors.projectAmount}
                />
              </div>
              <FieldError>{errors.projectAmount}</FieldError>
              <p className="text-xs text-muted-foreground">
                Este es el monto base que se le cobra al cliente antes de sumar adicionales.
              </p>
            </div>

            <div className="grid gap-3 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold">Responsables internos</h3>
                <p className="text-xs text-muted-foreground">
                  Define quién se encarga de propuesta, modelado, planos y render.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(Object.keys(PROJECT_SLICE_LABELS) as InternalArea[]).map((area) => (
                  <div key={area} className="grid gap-1.5">
                    <Label>{PROJECT_SLICE_LABELS[area]}</Label>
                    <Select
                      value={responsibles[area]}
                      onValueChange={(value) =>
                        value &&
                        setResponsibles((prev) => ({
                          ...prev,
                          [area]: value as ProjectResponsible,
                        }))
                      }
                      items={RESPONSIBLE_OPTIONS.map((person) => ({
                        label: person,
                        value: person,
                      }))}
                    >
                      <SelectTrigger className="w-full" aria-invalid={!!errors.responsibles}>
                        <SelectValue placeholder="Selecciona responsable" />
                      </SelectTrigger>
                      <SelectContent>
                        {RESPONSIBLE_OPTIONS.map((person) => (
                          <SelectItem key={person} value={person}>
                            {person}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <FieldError>{errors.responsibles}</FieldError>
            </div>

            <div className="grid gap-3 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold">Distribución del proyecto</h3>
                <p className="text-xs text-muted-foreground">
                  Reparten el {Math.round(PROYECTO_RATE * 100)}% del monto base. Deben sumar 100%.
                  Un área no puede quedar por debajo de lo ya pagado en ella.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {SLICE_KEYS.map((area) => {
                  const overpaid = areaAmounts[area] < paidByArea[area] - 0.001;
                  return (
                    <div key={area} className="grid gap-1.5">
                      <Label htmlFor={`w-${area}`}>{PROJECT_SLICE_LABELS[area]}</Label>
                      <div className="relative">
                        <Input
                          id={`w-${area}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="0.5"
                          value={weightInputs[area]}
                          onChange={(e) =>
                            setWeightInputs((p) => ({ ...p, [area]: e.target.value }))
                          }
                          className="pr-7"
                          aria-invalid={overpaid}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-xs tabular-nums",
                          overpaid ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {formatCurrency(areaAmounts[area])}
                        {paidByArea[area] > 0 && ` · pagado ${formatCurrency(paidByArea[area])}`}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                  weightsValid
                    ? "bg-brand-muted/50 text-brand-foreground"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                <span className="font-medium">Suma</span>
                <span className="font-semibold tabular-nums">{weightSum.toFixed(1)}% / 100%</span>
              </div>
              <FieldError>{errors.weights}</FieldError>
            </div>
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Adicionales</h2>
              <p className="text-xs text-muted-foreground">
                Montos extra. Se suman al total sin porcentajes.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-4" /> Agregar
            </Button>
          </div>
          <div className="p-5">
            {addons.length === 0 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-3 text-center text-xs text-muted-foreground">
                Sin adicionales.
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
      </div>

      <div className="lg:sticky lg:top-24">
        <Card className="gap-0 py-0">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Resumen</h2>
            <p className="text-xs text-muted-foreground">Cálculo automático del total.</p>
          </div>
          <div className="p-5">
            <DistributionPreview base={base} addons={parsedAddons} weights={weights} />
          </div>
          <div className="flex flex-col gap-2 border-t p-5">
            <Button
              onClick={submit}
              disabled={isPending || !weightsValid || hasAreaError}
              className="w-full"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push(`/projects/${project.id}`)}
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
