"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  Users,
  Plus,
  Trash2,
  Gem,
  Crown,
  SlidersHorizontal,
  Check,
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
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
import { formatCurrency, todayISODate } from "@/lib/format";
import {
  PROJECT_TEMPLATES,
  PROJECT_SLICE_LABELS,
  TEMPLATE_LABELS,
  TEMPLATE_WEIGHTS,
  PROYECTO_RATE,
  type ProjectTemplate,
  type ProjectSliceKey,
  type SliceWeights,
} from "@/lib/constants";
import type { Client, PaymentMethod } from "@/lib/types";
import { DistributionPreview } from "./distribution-preview";
import { createProjectAction } from "@/app/(dashboard)/projects/actions";

type ClientMode = "existing" | "new";
interface AddonRow {
  id: string;
  concept: string;
  amount: string;
}
type WeightInputs = Record<ProjectSliceKey, string>;

const TEMPLATE_ICONS: Record<ProjectTemplate, LucideIcon> = {
  diamante: Gem,
  oro: Crown,
  especial: SlidersHorizontal,
};

const SLICE_KEYS = Object.keys(PROJECT_SLICE_LABELS) as ProjectSliceKey[];
const STEPS = ["Plantilla", "Datos", "Confirmar"];

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

function newAddon(): AddonRow {
  return { id: crypto.randomUUID(), concept: "", amount: "" };
}

export function CreateProjectWizard({
  clients,
  methods,
}: {
  clients: Client[];
  methods: PaymentMethod[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [weightInputs, setWeightInputs] = useState<WeightInputs>({
    proposal: "20",
    modeling_3d: "30",
    plans: "35",
    render: "15",
  });

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

  // Resolve weights for preview/submit
  const especialSum = SLICE_KEYS.reduce((s, k) => s + (Number(weightInputs[k]) || 0), 0);
  const weights: SliceWeights = useMemo(() => {
    if (template === "especial") {
      const out = {} as SliceWeights;
      SLICE_KEYS.forEach((k) => (out[k] = (Number(weightInputs[k]) || 0) / 100));
      return out;
    }
    if (template === "oro" || template === "diamante") return TEMPLATE_WEIGHTS[template];
    return TEMPLATE_WEIGHTS.diamante;
  }, [template, weightInputs]);

  const especialValid = template !== "especial" || Math.abs(especialSum - 100) < 0.5;

  const selectedClientName =
    clientMode === "existing"
      ? clients.find((c) => c.id === clientId)?.name ?? "—"
      : clientName || "—";

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
        template: template ?? "diamante",
        weights: template === "especial" ? weights : undefined,
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
        setStep(1); // back to data step to show errors
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper step={step} />

      {step === 0 && (
        <StepTemplate
          template={template}
          onSelect={setTemplate}
          onNext={() => setStep(1)}
          onCancel={() => router.push("/projects")}
        />
      )}

      {step === 1 && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="flex flex-col gap-5">
            {/* Datos */}
            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-semibold">Datos del proyecto</h2>
                <p className="text-xs text-muted-foreground">
                  Plantilla {TEMPLATE_LABELS[template ?? "diamante"]} · información y cliente.
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
                  <FieldError>{errors.projectAmount}</FieldError>
                </div>
              </div>
            </Card>

            {/* Especial: pesos */}
            {template === "especial" && (
              <Card className="gap-0 py-0">
                <div className="border-b px-5 py-4">
                  <h2 className="text-sm font-semibold">Distribución personalizada</h2>
                  <p className="text-xs text-muted-foreground">
                    Define el peso de cada área. Deben sumar 100%.
                  </p>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {SLICE_KEYS.map((k) => (
                    <div key={k} className="grid gap-1.5">
                      <Label htmlFor={`w-${k}`}>{PROJECT_SLICE_LABELS[k]}</Label>
                      <div className="relative">
                        <Input
                          id={`w-${k}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="0.5"
                          value={weightInputs[k]}
                          onChange={(e) =>
                            setWeightInputs((p) => ({ ...p, [k]: e.target.value }))
                          }
                          className="pr-7"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                  ))}
                  <div
                    className={cn(
                      "sm:col-span-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                      especialValid ? "bg-brand-muted/50 text-brand-foreground" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    <span className="font-medium">Suma</span>
                    <span className="tabular-nums font-semibold">{especialSum.toFixed(1)}% / 100%</span>
                  </div>
                  <FieldError>{errors.weights}</FieldError>
                </div>
              </Card>
            )}

            {/* Adicionales */}
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
                  </div>
                )}
              </div>
            </Card>

            {/* Anticipo */}
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
                      <SelectTrigger id="ant-method" className="w-full" aria-invalid={!!errors.anticipoMethodId}>
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

          {/* Resumen + navegación */}
          <div className="lg:sticky lg:top-24">
            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4">
                <h2 className="text-sm font-semibold">Resumen</h2>
                <p className="text-xs text-muted-foreground">Cálculo automático del total.</p>
              </div>
              <div className="p-5">
                <DistributionPreview base={base} addons={parsedAddons} weights={weights} />
              </div>
              <div className="flex gap-2 border-t p-5">
                <Button variant="ghost" onClick={() => setStep(0)} className="flex-1">
                  <ArrowLeft className="size-4" /> Atrás
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!especialValid}
                  className="flex-1"
                >
                  Continuar <ArrowRight className="size-4" />
                </Button>
              </div>
              {!especialValid && (
                <p className="px-5 pb-4 text-xs text-destructive">
                  Los porcentajes de la plantilla especial deben sumar 100%.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {step === 2 && (
        <StepConfirm
          template={template ?? "diamante"}
          clientName={selectedClientName}
          name={name}
          base={base}
          addons={parsedAddons}
          weights={weights}
          registerAnticipo={registerAnticipo}
          anticipoAmount={Number(anticipoAmount) || 0}
          isPending={isPending}
          onBack={() => setStep(1)}
          onConfirm={submit}
        />
      )}
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done
                    ? "bg-brand text-brand-foreground"
                    : active
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1", done ? "bg-brand" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: template selection ───────────────────────────────────────────────
function StepTemplate({
  template,
  onSelect,
  onNext,
  onCancel,
}: {
  template: ProjectTemplate | null;
  onSelect: (t: ProjectTemplate) => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        {PROJECT_TEMPLATES.map((tpl) => {
          const Icon = TEMPLATE_ICONS[tpl.id];
          const active = template === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all",
                active
                  ? "border-brand bg-brand-muted/30 ring-2 ring-brand/40"
                  : "hover:border-foreground/20 hover:bg-accent/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    active ? "bg-brand text-brand-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {active && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Check className="size-4" />
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold">{tpl.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{tpl.description}</p>
              </div>
              <div className="mt-1 space-y-1 border-t pt-3">
                {tpl.weights ? (
                  SLICE_KEYS.map((k) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{PROJECT_SLICE_LABELS[k]}</span>
                      <span className="font-medium tabular-nums">
                        {Math.round(tpl.weights![k] * 100)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Tú defines los porcentajes (suman 100%).
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Reparten el {Math.round(PROYECTO_RATE * 100)}% del monto (porción Proyecto).
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onNext} disabled={!template}>
          Continuar <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: confirmation ─────────────────────────────────────────────────────
function StepConfirm({
  template,
  clientName,
  name,
  base,
  addons,
  weights,
  registerAnticipo,
  anticipoAmount,
  isPending,
  onBack,
  onConfirm,
}: {
  template: ProjectTemplate;
  clientName: string;
  name: string;
  base: number;
  addons: { concept: string; amount: number }[];
  weights: SliceWeights;
  registerAnticipo: boolean;
  anticipoAmount: number;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <Card className="gap-0 py-0">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Confirmar proyecto</h2>
          <p className="text-xs text-muted-foreground">
            Revisa los datos antes de generar el proyecto.
          </p>
        </div>
        <dl className="divide-y">
          <ReviewRow label="Plantilla" value={TEMPLATE_LABELS[template]} />
          <ReviewRow label="Nombre" value={name || "—"} />
          <ReviewRow label="Cliente" value={clientName} />
          <ReviewRow label="Monto del proyecto" value={formatCurrency(base)} />
          {addons.length > 0 && (
            <ReviewRow
              label="Adicionales"
              value={`${addons.length} · ${formatCurrency(addons.reduce((s, a) => s + a.amount, 0))}`}
            />
          )}
          <ReviewRow
            label="Anticipo"
            value={registerAnticipo ? formatCurrency(anticipoAmount) : "Sin anticipo"}
          />
        </dl>
      </Card>

      <div className="lg:sticky lg:top-24">
        <Card className="gap-0 py-0">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Resumen</h2>
          </div>
          <div className="p-5">
            <DistributionPreview base={base} addons={addons} weights={weights} />
          </div>
          <div className="flex gap-2 border-t p-5">
            <Button variant="ghost" onClick={onBack} disabled={isPending} className="flex-1">
              <ArrowLeft className="size-4" /> Atrás
            </Button>
            <Button onClick={onConfirm} disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Generar proyecto
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
