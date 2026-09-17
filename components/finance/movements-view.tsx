"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  WalletCards,
} from "lucide-react";
import {
  deleteFinanceMovementConceptAction,
  deleteFinanceMovementTagAction,
  saveFinanceCaptureAction,
  saveFinanceMovementConceptAction,
  saveFinanceMovementTagAction,
} from "@/app/(dashboard)/finance/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, todayISODate } from "@/lib/format";
import type {
  FinanceCapturePaymentForm,
  FinanceCaptureReport,
  FinanceMovementConcept,
  FinanceMovementTag,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_TAG = "__no_tag__";
const ALL_CONCEPTS = "__all_concepts__";
const ALL_TAGS = "__all_tags__";

const PAYMENT_FORM_LABELS: Record<FinanceCapturePaymentForm, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  check: "Cheque",
  deposit: "Depósito",
};

function signedCurrency(value: number) {
  if (Math.abs(value) < 0.001) return formatCurrency(0);
  return `${value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;
}

function monthStartISO(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function monthEndISO(date: string) {
  const [year, month] = date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function Metric({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={cn("p-5", accent && "border-transparent bg-brand text-brand-foreground")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", accent ? "text-brand-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          <p className={cn("mt-1 text-xs", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>
            {hint}
          </p>
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", accent ? "bg-brand-foreground/10" : "bg-brand-muted text-brand-foreground")}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function CaptureSheet({
  open,
  onOpenChange,
  report,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: FinanceCaptureReport;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [conceptId, setConceptId] = useState("");
  const [captureDate, setCaptureDate] = useState(todayISODate());
  const [amount, setAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [paymentForm, setPaymentForm] = useState<FinanceCapturePaymentForm>("transfer");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const conceptItems = useMemo(
    () => report.concepts.map((concept) => ({ value: concept.id, label: concept.name })),
    [report.concepts],
  );
  const accountItems = useMemo(
    () => report.accounts.map((account) => ({ value: account.id, label: account.name })),
    [report.accounts],
  );

  function reset() {
    setConceptId("");
    setCaptureDate(todayISODate());
    setAmount("");
    setSourceAccountId("");
    setPaymentForm("transfer");
    setDescription("");
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await saveFinanceCaptureAction({
        conceptId,
        captureDate,
        amount: Number(amount),
        sourceAccountId,
        paymentForm,
        description,
      });
      if (result.ok) {
        toast.success("Captura registrada", {
          description: `${formatCurrency(Number(amount))} · ${captureDate}`,
        });
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Nueva Captura</SheetTitle>
          <SheetDescription>
            Registra una captura contable con concepto, cuenta y forma de pago.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="capture-concept">Concepto</Label>
            <Select value={conceptId} onValueChange={(value) => setConceptId(value ?? "")} items={conceptItems}>
              <SelectTrigger id="capture-concept" className="w-full" aria-invalid={!!errors.conceptId}>
                <SelectValue placeholder="Seleccionar concepto" />
              </SelectTrigger>
              <SelectContent>
                {report.concepts.map((concept) => (
                  <SelectItem key={concept.id} value={concept.id}>
                    {concept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.conceptId && <p className="text-xs text-destructive">{errors.conceptId}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="capture-date">Fecha Contable</Label>
              <Input
                id="capture-date"
                type="date"
                value={captureDate}
                onChange={(event) => setCaptureDate(event.target.value)}
                aria-invalid={!!errors.captureDate}
              />
              {errors.captureDate && <p className="text-xs text-destructive">{errors.captureDate}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capture-amount">Valor</Label>
              <MoneyInput
                id="capture-amount"
                value={amount}
                onValueChange={setAmount}
                placeholder="0.00"
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="capture-account">Cuenta de origen</Label>
              <Select value={sourceAccountId} onValueChange={(value) => setSourceAccountId(value ?? "")} items={accountItems}>
                <SelectTrigger id="capture-account" className="w-full" aria-invalid={!!errors.sourceAccountId}>
                  <SelectValue placeholder="Cuenta origen" />
                </SelectTrigger>
                <SelectContent>
                  {report.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sourceAccountId && <p className="text-xs text-destructive">{errors.sourceAccountId}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capture-payment-form">Forma de pago</Label>
              <Select
                value={paymentForm}
                onValueChange={(value) => setPaymentForm((value as FinanceCapturePaymentForm) ?? "transfer")}
                items={Object.entries(PAYMENT_FORM_LABELS).map(([value, label]) => ({ value, label }))}
              >
                <SelectTrigger id="capture-payment-form" className="w-full" aria-invalid={!!errors.paymentForm}>
                  <SelectValue placeholder="Forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_FORM_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paymentForm && <p className="text-xs text-destructive">{errors.paymentForm}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="capture-description">Nombre / Descripción</Label>
            <Textarea
              id="capture-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción del movimiento"
              aria-invalid={!!errors.description}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <Button onClick={submit} disabled={isPending || report.concepts.length === 0}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Guardar captura
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CatalogsTab({ report }: { report: FinanceCaptureReport }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [catalogTab, setCatalogTab] = useState("conceptos");
  const [conceptFormOpen, setConceptFormOpen] = useState(false);
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [conceptName, setConceptName] = useState("");
  const [tagId, setTagId] = useState<string>(NO_TAG);
  const [editingTag, setEditingTag] = useState<FinanceMovementTag | null>(null);
  const [editingConcept, setEditingConcept] = useState<FinanceMovementConcept | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tagItems = useMemo(
    () => [
      { value: NO_TAG, label: "Sin etiqueta" },
      ...report.tags.map((tagItem) => ({ value: tagItem.id, label: tagItem.name })),
    ],
    [report.tags],
  );

  function resetConceptForm() {
    setConceptName("");
    setTagId(NO_TAG);
    setEditingConcept(null);
    setErrors({});
  }

  function resetTagForm() {
    setTagName("");
    setEditingTag(null);
    setErrors({});
  }

  function saveTag() {
    setErrors({});
    startTransition(async () => {
      const result = await saveFinanceMovementTagAction({
        id: editingTag?.id ?? "",
        name: tagName,
      });
      if (result.ok) {
        toast.success(editingTag ? "Etiqueta actualizada" : "Etiqueta guardada");
        resetTagForm();
        setTagFormOpen(false);
        router.refresh();
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
      }
    });
  }

  function saveConcept() {
    setErrors({});
    startTransition(async () => {
      const result = await saveFinanceMovementConceptAction({
        id: editingConcept?.id ?? "",
        name: conceptName,
        tagId: tagId === NO_TAG ? null : tagId,
      });
      if (result.ok) {
        toast.success(editingConcept ? "Concepto actualizado" : "Concepto guardado");
        resetConceptForm();
        setConceptFormOpen(false);
        router.refresh();
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
      }
    });
  }

  function deleteConcept(concept: FinanceMovementConcept) {
    if (!window.confirm(`¿Eliminar el concepto "${concept.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteFinanceMovementConceptAction({ id: concept.id });
      if (result.ok) {
        toast.success("Concepto eliminado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function deleteTag(tagItem: FinanceMovementTag) {
    if (!window.confirm(`¿Eliminar la etiqueta "${tagItem.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteFinanceMovementTagAction({ id: tagItem.id });
      if (result.ok) {
        toast.success("Etiqueta eliminada");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
    <Tabs value={catalogTab} onValueChange={setCatalogTab} className="gap-5">
      <TabsList variant="line" className="flex w-full flex-wrap justify-start gap-2">
        <TabsTrigger value="conceptos" className="flex-none px-3">
          <ClipboardList className="size-4" />
          Concepto
        </TabsTrigger>
        <TabsTrigger value="etiquetas" className="flex-none px-3">
          <Tag className="size-4" />
          Etiquetas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="conceptos">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold">Conceptos</h2>
              <p className="text-sm text-muted-foreground">Catálogo usado en el modal de captura.</p>
            </div>
            <Button
              onClick={() => {
                resetConceptForm();
                setConceptFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nuevo Concepto
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-16 px-5 text-xs uppercase text-muted-foreground">ID</TableHead>
                  <TableHead className="min-w-72 text-xs uppercase text-muted-foreground">Nombre</TableHead>
                  <TableHead className="min-w-56 text-xs uppercase text-muted-foreground">Etiqueta</TableHead>
                  <TableHead className="w-28 px-5 text-right text-xs uppercase text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.concepts.map((concept, index) => (
                  <TableRow key={concept.id}>
                    <TableCell className="px-5 text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{concept.name}</TableCell>
                    <TableCell className="text-muted-foreground">{concept.tag?.name ?? "-"}</TableCell>
                    <TableCell className="px-5">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setConceptName(concept.name);
                            setTagId(concept.tag_id ?? NO_TAG);
                            setEditingConcept(concept);
                            setConceptFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Editar concepto</span>
                        </Button>
                        <Button variant="outline" size="icon" className="size-8" onClick={() => deleteConcept(concept)}>
                          <Trash2 className="size-4" />
                          <span className="sr-only">Eliminar concepto</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {report.concepts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Sin conceptos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="etiquetas">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold">Etiquetas</h2>
              <p className="text-sm text-muted-foreground">Agrupa conceptos para reportes y filtros.</p>
            </div>
            <Button
              onClick={() => {
                resetTagForm();
                setTagFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nueva Etiqueta
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-16 px-5 text-xs uppercase text-muted-foreground">ID</TableHead>
                  <TableHead className="min-w-72 text-xs uppercase text-muted-foreground">Nombre</TableHead>
                  <TableHead className="px-5 text-right text-xs uppercase text-muted-foreground">Conceptos</TableHead>
                  <TableHead className="w-28 px-5 text-right text-xs uppercase text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.tags.map((tagItem, index) => (
                  <TableRow key={tagItem.id}>
                    <TableCell className="px-5 text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{tagItem.name}</TableCell>
                    <TableCell className="px-5 text-right tabular-nums text-muted-foreground">
                      {report.concepts.filter((concept) => concept.tag_id === tagItem.id).length}
                    </TableCell>
                    <TableCell className="px-5">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setTagName(tagItem.name);
                            setEditingTag(tagItem);
                            setTagFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Editar etiqueta</span>
                        </Button>
                        <Button variant="outline" size="icon" className="size-8" onClick={() => deleteTag(tagItem)}>
                          <Trash2 className="size-4" />
                          <span className="sr-only">Eliminar etiqueta</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {report.tags.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Sin etiquetas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </TabsContent>
    </Tabs>

    <Sheet
      open={conceptFormOpen}
      onOpenChange={(open) => {
        setConceptFormOpen(open);
        if (!open) resetConceptForm();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editingConcept ? "Editar Concepto" : "Nuevo Concepto"}</SheetTitle>
          <SheetDescription>Registra el concepto y asígnalo a una etiqueta.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="concept-name">Nombre</Label>
            <Input
              id="concept-name"
              value={conceptName}
              onChange={(event) => setConceptName(event.target.value)}
              placeholder="Nombre del concepto"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="concept-tag">Etiqueta</Label>
            <Select value={tagId} onValueChange={(value) => setTagId(value ?? NO_TAG)} items={tagItems}>
              <SelectTrigger id="concept-tag" className="w-full">
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TAG}>Sin etiqueta</SelectItem>
                {report.tags.map((tagItem) => (
                  <SelectItem key={tagItem.id} value={tagItem.id}>
                    {tagItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tagId && <p className="text-xs text-destructive">{errors.tagId}</p>}
          </div>
          <Button onClick={saveConcept} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {editingConcept ? "Guardar Concepto" : "Crear Concepto"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <Sheet
      open={tagFormOpen}
      onOpenChange={(open) => {
        setTagFormOpen(open);
        if (!open) resetTagForm();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingTag ? "Editar Etiqueta" : "Nueva Etiqueta"}</SheetTitle>
          <SheetDescription>Configura la etiqueta para agrupar conceptos.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="tag-name">Nombre</Label>
            <Input
              id="tag-name"
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="Nombre de etiqueta"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <Button onClick={saveTag} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {editingTag ? "Guardar Etiqueta" : "Crear Etiqueta"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

function CapturesTab({ report }: { report: FinanceCaptureReport }) {
  const [open, setOpen] = useState(false);
  const currentMonthStart = monthStartISO(todayISODate());
  const currentMonthEnd = monthEndISO(todayISODate());
  const [draftFrom, setDraftFrom] = useState(currentMonthStart);
  const [draftTo, setDraftTo] = useState(currentMonthEnd);
  const [draftTag, setDraftTag] = useState(ALL_TAGS);
  const [draftConcept, setDraftConcept] = useState(ALL_CONCEPTS);
  const [filters, setFilters] = useState({
    from: currentMonthStart,
    to: currentMonthEnd,
    tag: ALL_TAGS,
    concept: ALL_CONCEPTS,
  });

  const conceptItems = useMemo(
    () => [
      { value: ALL_CONCEPTS, label: "Todos" },
      ...report.concepts.map((concept) => ({ value: concept.id, label: concept.name })),
    ],
    [report.concepts],
  );
  const tagItems = useMemo(
    () => [
      { value: ALL_TAGS, label: "Todas" },
      ...report.tags.map((tagItem) => ({ value: tagItem.id, label: tagItem.name })),
    ],
    [report.tags],
  );

  const filteredRows = useMemo(
    () =>
      report.rows.filter((row) => {
        if (filters.from && row.capture_date < filters.from) return false;
        if (filters.to && row.capture_date > filters.to) return false;
        if (filters.tag !== ALL_TAGS && row.concept?.tag_id !== filters.tag) return false;
        if (filters.concept !== ALL_CONCEPTS && row.concept_id !== filters.concept) return false;
        return true;
      }),
    [filters, report.rows],
  );

  const filteredTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.amount, 0),
    [filteredRows],
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total capturado"
          value={formatCurrency(report.totals.amount)}
          hint="Acumulado de registros"
          icon={<WalletCards className="size-5" />}
          accent
        />
        <Metric
          label="Mes actual"
          value={formatCurrency(report.totals.currentMonthAmount)}
          hint="Capturas del mes"
          icon={<CalendarDays className="size-5" />}
        />
        <Metric
          label="Saldo actual"
          value={signedCurrency(report.totals.currentBalance)}
          hint="Saldo posterior acumulado"
          icon={<ClipboardList className="size-5" />}
        />
        <Metric
          label="Registros"
          value={String(report.totals.count)}
          hint="Capturas activas"
          icon={<Tag className="size-5" />}
        />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">Registros de Captura</h2>
              <p className="text-sm text-muted-foreground">
                Capturas contables por concepto, cuenta de origen y forma de pago.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Nueva Captura
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[110px_110px_1fr_1fr_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="movement-from" className="text-xs">Desde:</Label>
              <Input
                id="movement-from"
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="movement-to" className="text-xs">Hasta:</Label>
              <Input
                id="movement-to"
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="movement-tag" className="text-xs">Etiquetas:</Label>
              <Select value={draftTag} onValueChange={(value) => setDraftTag(value ?? ALL_TAGS)} items={tagItems}>
                <SelectTrigger id="movement-tag" className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TAGS}>Todas</SelectItem>
                  {report.tags.map((tagItem) => (
                    <SelectItem key={tagItem.id} value={tagItem.id}>
                      {tagItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="movement-concept" className="text-xs">Conceptos:</Label>
              <Select value={draftConcept} onValueChange={(value) => setDraftConcept(value ?? ALL_CONCEPTS)} items={conceptItems}>
                <SelectTrigger id="movement-concept" className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CONCEPTS}>Todos</SelectItem>
                  {report.concepts.map((concept) => (
                    <SelectItem key={concept.id} value={concept.id}>
                      {concept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid items-end">
              <Button
                onClick={() =>
                  setFilters({
                    from: draftFrom,
                    to: draftTo,
                    tag: draftTag,
                    concept: draftConcept,
                  })
                }
              >
                <Search className="size-4" />
                Filtrar
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-14 px-5 text-xs uppercase text-muted-foreground">#</TableHead>
                <TableHead className="min-w-56 text-xs uppercase text-muted-foreground">Concepto</TableHead>
                <TableHead className="text-xs uppercase text-muted-foreground">Fecha</TableHead>
                <TableHead className="text-right text-xs uppercase text-muted-foreground">Valor</TableHead>
                <TableHead className="min-w-44 text-xs uppercase text-muted-foreground">Cuenta de origen</TableHead>
                <TableHead className="min-w-40 text-xs uppercase text-muted-foreground">Forma de pago</TableHead>
                <TableHead className="min-w-72 px-5 text-xs uppercase text-muted-foreground">Nombre / Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="px-5 text-muted-foreground">{filteredRows.length - index}</TableCell>
                  <TableCell className="font-medium">{row.concept?.name ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.capture_date)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                    {formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.account?.name ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{PAYMENT_FORM_LABELS[row.payment_form]}</TableCell>
                  <TableCell className="px-5 text-muted-foreground">{row.description || "-"}</TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Sin capturas registradas para los filtros.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.length > 0 && (
                <TableRow className="bg-muted/30 font-semibold hover:bg-muted/30">
                  <TableCell className="px-5" colSpan={3}>
                    Total filtrado
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-brand-foreground">
                    {formatCurrency(filteredTotal)}
                  </TableCell>
                  <TableCell className="px-5" colSpan={3} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CaptureSheet open={open} onOpenChange={setOpen} report={report} />
    </>
  );
}

export function MovementsView({ report }: { report: FinanceCaptureReport }) {
  return (
    <Tabs defaultValue="registrar" className="gap-5">
      <TabsList variant="line" className="flex w-full flex-wrap justify-start gap-2">
        <TabsTrigger value="registrar" className="flex-none px-3">
          <ClipboardList className="size-4" />
          Registrar
        </TabsTrigger>
        <TabsTrigger value="catalogos" className="flex-none px-3">
          <Tag className="size-4" />
          Catálogos de conceptos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="registrar" className="flex flex-col gap-5">
        <CapturesTab report={report} />
      </TabsContent>
      <TabsContent value="catalogos">
        <CatalogsTab report={report} />
      </TabsContent>
    </Tabs>
  );
}
