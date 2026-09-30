"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Users, Plus, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  RESPONSIBLE_OPTIONS,
  PROJECT_SLICE_LABELS,
  PROYECTO_RATE,
  type SliceWeights,
} from "@/lib/constants";
import type { Client, InternalArea, ProjectResponsible, ProjectWithFinance } from "@/lib/types";
import {
  weightsFromAmounts,
  computeBreakdown,
  round2,
  type ProjectDistribution,
} from "@/lib/calculations";
import { DistributionPreview } from "./distribution-preview";
import { updateProjectAction } from "@/app/(dashboard)/projects/actions";

type ClientMode = "existing" | "new";
type DistributionInputMode = "percent" | "amount";
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

function normalizeAmountWeights(
  inputs: Record<InternalArea, string>,
  fallback: SliceWeights,
): SliceWeights {
  const values = SLICE_KEYS.map((key) => Math.max(Number(inputs[key]) || 0, 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return fallback;
  return SLICE_KEYS.reduce((acc, key, index) => {
    acc[key] = values[index] / total;
    return acc;
  }, {} as SliceWeights);
}

function weightsToInputs(weights: SliceWeights): Record<InternalArea, string> {
  return SLICE_KEYS.reduce((acc, key) => {
    acc[key] = String(round2(weights[key] * 100));
    return acc;
  }, {} as Record<InternalArea, string>);
}

function amountInputsToDistribution(
  inputs: Record<InternalArea, string>,
): ProjectDistribution {
  return SLICE_KEYS.reduce((acc, key) => {
    const value = Number(inputs[key]) || 0;
    acc[key] = round2(Math.max(value, 0));
    return acc;
  }, {} as ProjectDistribution);
}

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
  const isCreditProject = project.template === "credito";
  const supportsAmountDistribution = project.template === "especial";

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
  const [distributionMode, setDistributionMode] = useState<DistributionInputMode>("percent");
  const [amountInputs, setAmountInputs] = useState<Record<InternalArea, string>>({
    proposal: String(project.proposal_amount),
    modeling_3d: String(project.modeling_3d_amount),
    plans: String(project.plans_amount),
    render: String(project.render_amount),
  });

  const base = isCreditProject ? 0 : Number(projectAmount);
  const parsedAddons = addons.map((a) => ({
    concept: a.concept,
    amount: Number(a.amount) || 0,
  }));

  const weightSum = SLICE_KEYS.reduce((s, k) => s + (Number(weightInputs[k]) || 0), 0);
  const amountDistribution = amountInputsToDistribution(amountInputs);
  const amountDistributionTotal = round2(
    SLICE_KEYS.reduce((s, k) => s + amountDistribution[k], 0),
  );
  const usingAmountDistribution = supportsAmountDistribution && distributionMode === "amount";
  const amountModeWeights = normalizeAmountWeights(amountInputs, initialWeights);
  const weightsValid = usingAmountDistribution
    ? amountDistributionTotal > 0
    : Math.abs(weightSum - 100) < 0.5;
  const weights: SliceWeights = usingAmountDistribution
    ? amountModeWeights
    : {
        proposal: (Number(weightInputs.proposal) || 0) / 100,
        modeling_3d: (Number(weightInputs.modeling_3d) || 0) / 100,
        plans: (Number(weightInputs.plans) || 0) / 100,
        render: (Number(weightInputs.render) || 0) / 100,
      };
  // In amount mode, the typed values are exact budgets per area.
  const areaAmounts: Record<InternalArea, number> = usingAmountDistribution
    ? amountDistribution
    : computeBreakdown(base || 0, [], weights).project;
  // An area cannot drop below what was already paid (spent) in it.
  const areaErrors = isCreditProject
    ? []
    : SLICE_KEYS.filter((k) => areaAmounts[k] < paidByArea[k] - 0.001);
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
  function changeDistributionMode(next: DistributionInputMode) {
    if (next === distributionMode) return;
    if (next === "amount") {
      setAmountInputs(
        SLICE_KEYS.reduce((acc, key) => {
          acc[key] = areaAmounts[key] > 0 ? String(areaAmounts[key]) : "";
          return acc;
        }, {} as Record<InternalArea, string>),
      );
    } else if (amountDistributionTotal > 0) {
      setWeightInputs(weightsToInputs(amountModeWeights));
    }
    setDistributionMode(next);
  }

  function submit() {
    setErrors({});
    if (!weightsValid) {
      setErrors({
        weights: usingAmountDistribution
          ? "Ingresa al menos un monto para calcular la distribución"
          : "Los porcentajes deben sumar 100%",
      });
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
        distributionMode: supportsAmountDistribution ? distributionMode : undefined,
        distributionAmounts: usingAmountDistribution ? amountDistribution : undefined,
        distributionAmountTotal: usingAmountDistribution ? amountDistributionTotal : undefined,
        projectAmount: isCreditProject ? 0 : Number(projectAmount),
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
              {isCreditProject
                ? "Proyecto sin monto fijo; los movimientos actualizan la deuda asociada."
                : `Ya cobrado: ${formatCurrency(project.finance.income)}. El total resultante no puede ser menor.`}
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

            {isCreditProject ? (
              <div className="rounded-xl border border-brand/25 bg-brand-muted/20 px-4 py-3">
                <p className="text-sm font-semibold text-brand-foreground">
                  Proyecto a crédito
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Este proyecto no tiene monto base. Los egresos registrados aumentan
                  la deuda del cliente y los ingresos quedan como abonos.
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="base">Monto del proyecto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <MoneyInput
                    id="base"
                    value={projectAmount}
                    onValueChange={setProjectAmount}
                    className="pl-7 text-base font-medium"
                    aria-invalid={!!errors.projectAmount}
                  />
                </div>
                <FieldError>{errors.projectAmount}</FieldError>
                <p className="text-xs text-muted-foreground">
                  Este es el monto base que se le cobra al cliente antes de sumar adicionales.
                </p>
              </div>
            )}

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

            {!isCreditProject && (
              <div className="grid gap-3 border-t pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Distribución del proyecto</h3>
                    <p className="text-xs text-muted-foreground">
                      Reparten el {Math.round(PROYECTO_RATE * 100)}% del monto base.
                      {supportsAmountDistribution
                        ? " Puedes definirlo por porcentaje o por monto."
                        : " Deben sumar 100%."}
                      {" "}Un área no puede quedar por debajo de lo ya pagado en ella.
                    </p>
                  </div>
                  {supportsAmountDistribution && (
                    <div className="grid grid-cols-2 rounded-lg border bg-muted/30 p-1 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => changeDistributionMode("percent")}
                        className={cn(
                          "rounded-md px-3 py-1.5 transition-colors",
                          distributionMode === "percent"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        aria-pressed={distributionMode === "percent"}
                      >
                        Porcentaje
                      </button>
                      <button
                        type="button"
                        onClick={() => changeDistributionMode("amount")}
                        className={cn(
                          "rounded-md px-3 py-1.5 transition-colors",
                          distributionMode === "amount"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        aria-pressed={distributionMode === "amount"}
                      >
                        Monto
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {SLICE_KEYS.map((area) => {
                    const overpaid = areaAmounts[area] < paidByArea[area] - 0.001;
                    return (
                      <div key={area} className="grid gap-1.5">
                        <Label htmlFor={`w-${area}`}>{PROJECT_SLICE_LABELS[area]}</Label>
                        <div className="relative">
                          {usingAmountDistribution && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              $
                            </span>
                          )}
                          {usingAmountDistribution ? (
                            <MoneyInput
                              id={`w-${area}`}
                              value={amountInputs[area]}
                              onValueChange={(value) =>
                                setAmountInputs((p) => ({ ...p, [area]: value }))
                              }
                              placeholder="0.00"
                              className="pl-7"
                              aria-invalid={overpaid}
                            />
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-xs tabular-nums",
                            overpaid ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {usingAmountDistribution && amountDistributionTotal > 0
                            ? `${formatPercent(amountModeWeights[area] * 100)} · ${formatCurrency(areaAmounts[area])}`
                            : formatCurrency(areaAmounts[area])}
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
                  <span className="font-semibold tabular-nums">
                    {usingAmountDistribution
                      ? amountDistributionTotal > 0
                        ? formatCurrency(amountDistributionTotal)
                        : "Ingresa montos"
                      : `${weightSum.toFixed(1)}% / 100%`}
                  </span>
                </div>
                <FieldError>{errors.weights}</FieldError>
              </div>
            )}
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
                      <MoneyInput
                        value={a.amount}
                        onValueChange={(value) => updateAddon(a.id, { amount: value })}
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
            <DistributionPreview
              base={base}
              addons={parsedAddons}
              weights={weights}
              projectDistribution={usingAmountDistribution ? amountDistribution : undefined}
              creditMode={isCreditProject}
            />
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
