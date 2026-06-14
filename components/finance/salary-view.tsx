"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronRight,
  ClipboardPen,
  Download,
  Eye,
  FolderKanban,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  ShieldCheck,
  Trash2,
  WalletCards,
  Wrench,
} from "lucide-react";
import {
  deleteSalaryPaymentAction,
  saveSalaryDayRecordAction,
  saveSalaryPaymentAction,
  saveSalaryWeekAction,
  updateSalaryWeekStatusAction,
} from "@/app/(dashboard)/finance/actions";
import { round2 } from "@/lib/calculations";
import { ChartCard } from "@/components/charts/chart-card";
import { CHART_COLORS } from "@/components/charts/palette";
import { DonutChart } from "@/components/charts/charts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import {
  EMPLOYEE_DEFAULT_WORK_TYPE_LABELS,
  SALARY_ACTIVITY_TYPES,
  SALARY_ASSIGNMENT_LABELS,
  SALARY_PAYMENT_TYPE_LABELS,
  SALARY_PAYMENT_TYPES,
  SALARY_RECORD_STATUS_LABELS,
  SALARY_WEEK_STATUS_LABELS,
  SALARY_WEEKDAY_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Employee,
  SalaryActivityType,
  SalaryDayRecordWithRelations,
  SalaryPaymentStatus,
  SalaryPaymentType,
  SalaryPaymentWithRelations,
  SalaryReport,
  SalaryWeekStatus,
  SalaryWeekWithRows,
  SalaryWeekday,
  TaskType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;
const EMPTY = "__none__";

type SalaryOption = { id: string; name: string };
type SalaryProjectOption = SalaryOption & {
  clientName: string;
  taskBudgets: Record<string, number>;
  // Amount already settled per area via the project's expense movements.
  // Lets the salary module avoid double-paying a completed area.
  taskPaid: Record<string, number>;
  assignments: { employeeName: string; taskName: string }[];
};
type SalaryPaymentDraft = {
  paymentType: SalaryPaymentType;
  concept: string;
  amount: number;
  projectId: string | null;
  workId: string | null;
  taskTypeId: string | null;
};
type SalaryReceiptGroup = {
  kind: "proyecto" | "obra";
  refId: string;
  name: string;
  amount: number;
};

function money(value: string) {
  return Number(value || 0);
}

function statusTone(status: SalaryWeekStatus | SalaryPaymentStatus | "draft" | "recorded" | "observed") {
  if (status === "paid" || status === "recorded") return "bg-brand-muted text-brand-foreground";
  if (status === "observed") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function activityTone(activity: SalaryActivityType) {
  if (activity === "project") return "bg-rose-100 text-rose-700";
  if (activity === "work") return "bg-sky-100 text-sky-700";
  if (activity === "pending") return "bg-amber-100 text-amber-800";
  return activity === "absent" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
}

function currencyOrDash(value: number | null) {
  return value === null ? "—" : formatCurrency(value);
}

function salaryReceiptGroups(payments: SalaryPaymentWithRelations[]) {
  const map = new Map<string, SalaryReceiptGroup>();
  for (const payment of payments) {
    const isProject = !!payment.project_id;
    const isWork = !!payment.work_id;
    if (!isProject && !isWork) continue;

    const kind = isProject ? "proyecto" : "obra";
    const refId = (isProject ? payment.project_id : payment.work_id) as string;
    const name = payment.project?.name ?? payment.work?.name ?? "Sin nombre";
    const key = `${kind}:${refId}`;
    const current = map.get(key) ?? { kind, refId, name, amount: 0 };
    current.amount = round2(current.amount + payment.amount);
    map.set(key, current);
  }

  return [...map.values()].filter((group) => group.amount > 0);
}

// Resolve the cell label strictly by activity type so a stale project/work id
// never leaks the wrong reference name.
function recordLabel(record: SalaryDayRecordWithRelations | null) {
  if (!record) return "Sin detalle";
  if (record.activity_type === "project") return record.project?.name ?? "Proyecto sin asignar";
  if (record.activity_type === "work") return record.work?.name ?? "Obra sin asignar";
  if (record.activity_type === "absent") return "Ausente";
  return record.taskType?.name ?? "Sin detalle";
}

function paidCurrencyOrDash(value: number) {
  return value > 0 ? formatCurrency(value) : "—";
}

function weekdayDate(weekStart: string, day: SalaryWeekday) {
  const index = WEEKDAYS.indexOf(day);
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + index);
  return date.toISOString().slice(0, 10);
}

function Metric({
  label,
  value,
  hint,
  icon,
  accent,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
  tone?: "success" | "danger";
}) {
  return (
    <Card className={cn("p-5", accent && "border-transparent bg-brand text-brand-foreground")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", accent ? "text-brand-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              !accent && tone === "success" && "text-brand-foreground",
              !accent && tone === "danger" && "text-destructive",
            )}
          >
            {value}
          </p>
          <p className={cn("mt-1 text-xs", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>
            {hint}
          </p>
        </div>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            accent
              ? "bg-brand-foreground/10"
              : tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-brand-muted text-brand-foreground",
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function MonthToolbar({
  report,
  onCreateWeek,
}: {
  report: SalaryReport;
  onCreateWeek: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const monthItems = useMemo(
    () =>
      report.months.map((item) => ({
        value: `${item.year}-${String(item.month).padStart(2, "0")}`,
        label: item.label,
      })),
    [report.months],
  );

  const yearItems = useMemo(
    () =>
      [...new Set(report.months.map((item) => item.year))]
        .sort((a, b) => b - a)
        .map((year) => ({ value: String(year), label: String(year) })),
    [report.months],
  );

  function replaceParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function exportCsv() {
    const rows = [
      ["Semana", "Empleado", "Fecha", "Día", "Actividad", "Referencia", "Tarea", "Pago", "Método", "Estado"],
    ];
    for (const week of report.weeks) {
      for (const employee of week.employees) {
        for (const day of WEEKDAYS) {
          const record = employee.dayRecords[day];
          rows.push([
            `${week.week_start_date} / ${week.week_end_date}`,
            employee.employee.full_name,
            record?.work_date ?? "",
            SALARY_WEEKDAY_LABELS[day],
            record ? SALARY_ASSIGNMENT_LABELS[record.activity_type] : "",
            record?.project?.name ?? record?.work?.name ?? "",
            record?.taskType?.name ?? "",
            "",
            "",
            record?.status ? SALARY_RECORD_STATUS_LABELS[record.status] : "",
          ]);
        }
        for (const payment of employee.payments) {
          rows.push([
            `${week.week_start_date} / ${week.week_end_date}`,
            employee.employee.full_name,
            payment.payment_date,
            "",
            SALARY_PAYMENT_TYPE_LABELS[payment.payment_type],
            payment.project?.name ?? payment.work?.name ?? "",
            payment.taskType?.name ?? payment.concept,
            String(payment.amount),
            payment.method?.name ?? "",
            "Pagado",
          ]);
        }
      }
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `salarios-${report.selected.year}-${String(report.selected.month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Mes</Label>
            <Select
              value={`${report.selected.year}-${String(report.selected.month).padStart(2, "0")}`}
              onValueChange={(value) => {
                const [year, month] = (value ?? "").split("-");
                replaceParams({ year, month });
              }}
              items={monthItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona mes" />
              </SelectTrigger>
              <SelectContent>
                {monthItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Año</Label>
            <Select
              value={String(report.selected.year)}
              onValueChange={(value) =>
                replaceParams({ year: value ?? String(report.selected.year), month: String(report.selected.month) })
              }
              items={yearItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona año" />
              </SelectTrigger>
              <SelectContent>
                {yearItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={onCreateWeek}>
            <Plus className="size-4" />
            Crear semana
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WeekSheet({
  open,
  onOpenChange,
  week,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: SalaryWeekWithRows | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(week?.week_start_date ?? "");
  const [paymentDate, setPaymentDate] = useState(week?.payment_date ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await saveSalaryWeekAction({
        id: week?.id ?? "",
        startDate,
        paymentDate,
        status: week?.status ?? "draft",
      });
      if (result.ok) {
        toast.success(week ? "Semana actualizada" : "Semana creada");
        onOpenChange(false);
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{week ? "Editar semana" : "Crear semana"}</SheetTitle>
          <SheetDescription>La semana se genera de lunes a viernes y la fecha de pago suele caer en viernes.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label>Inicio de semana</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-invalid={!!errors.startDate} />
            {errors.startDate ? <p className="text-xs text-destructive">{errors.startDate}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Fecha de pago</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} aria-invalid={!!errors.paymentDate} />
            {errors.paymentDate ? <p className="text-xs text-destructive">{errors.paymentDate}</p> : null}
          </div>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
            Guardar semana
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivitySheet({
  open,
  onOpenChange,
  week,
  employee,
  day,
  record,
  projectOptions,
  workOptions,
  taskTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: SalaryWeekWithRows | null;
  employee: Employee | null;
  day: SalaryWeekday | null;
  record: SalaryDayRecordWithRelations | null;
  projectOptions: SalaryProjectOption[];
  workOptions: SalaryOption[];
  taskTypes: TaskType[];
}) {
  const [isPending, startTransition] = useTransition();
  const [activityType, setActivityType] = useState<SalaryActivityType>(record?.activity_type ?? "pending");
  const [projectId, setProjectId] = useState<string | null>(record?.project_id ?? null);
  const [workId, setWorkId] = useState<string | null>(record?.work_id ?? null);
  const [taskTypeId, setTaskTypeId] = useState<string | null>(record?.task_type_id ?? null);
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredProjectOptions = useMemo(() => {
    if (!employee) return projectOptions;
    return projectOptions.filter((project) =>
      project.assignments.some((assignment) => assignment.employeeName === employee.full_name),
    );
  }, [employee, projectOptions]);

  const filteredTasks = useMemo(() => {
    if (activityType === "project") {
      const selectedProject = filteredProjectOptions.find((item) => item.id === projectId);
      const allowedTaskNames = selectedProject
        ? selectedProject.assignments
            .filter((assignment) => assignment.employeeName === employee?.full_name)
            .map((assignment) => assignment.taskName)
        : [];

      return taskTypes.filter(
        (item) =>
          allowedTaskNames.includes(item.name) &&
          (item.module_type === "project" || item.module_type === "general"),
      );
    }
    if (activityType === "work") {
      return taskTypes.filter((item) => item.module_type === "work" || item.module_type === "general");
    }
    return taskTypes;
  }, [activityType, employee?.full_name, filteredProjectOptions, projectId, taskTypes]);

  const workDate = week && day ? weekdayDate(week.week_start_date, day) : "";

  function handleProjectChange(value: string | null) {
    const nextProjectId = value === EMPTY ? null : value;
    setProjectId(nextProjectId);

    const selectedProject = filteredProjectOptions.find((item) => item.id === nextProjectId);
    const allowedTaskNames = selectedProject
      ? selectedProject.assignments
          .filter((assignment) => assignment.employeeName === employee?.full_name)
          .map((assignment) => assignment.taskName)
      : [];
    const nextTasks = taskTypes.filter(
      (item) =>
        allowedTaskNames.includes(item.name) &&
        (item.module_type === "project" || item.module_type === "general"),
    );

    if (nextTasks.length === 1) {
      setTaskTypeId(nextTasks[0].id);
      return;
    }
    if (!nextTasks.some((item) => item.id === taskTypeId)) {
      setTaskTypeId(null);
    }
  }

  function submit() {
    if (!week || !employee || !day) return;
    setErrors({});
    startTransition(async () => {
      const result = await saveSalaryDayRecordAction({
        id: record?.id ?? "",
        salaryWeekId: week.id,
        employeeId: employee.id,
        workDate,
        dayName: day,
        activityType,
        projectId: activityType === "project" ? projectId : null,
        workId: activityType === "work" ? workId : null,
        taskTypeId: activityType === "project" ? taskTypeId : null,
        notes,
        status: "recorded",
      });
      if (result.ok) {
        toast.success("Actividad registrada");
        onOpenChange(false);
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Actividad diaria</SheetTitle>
          <SheetDescription>
            {employee?.full_name} · {day ? SALARY_WEEKDAY_LABELS[day] : "Sin día"} · {workDate || "Sin fecha"}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label>Tipo de actividad</Label>
            <Select
              value={activityType}
              onValueChange={(value) => setActivityType((value ?? "pending") as SalaryActivityType)}
              items={SALARY_ACTIVITY_TYPES.map((value) => ({ label: SALARY_ASSIGNMENT_LABELS[value], value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALARY_ACTIVITY_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {SALARY_ASSIGNMENT_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activityType === "project" ? (
            <div className="grid gap-2">
              <Label>Proyecto</Label>
              <Select value={projectId ?? EMPTY} onValueChange={handleProjectChange} items={filteredProjectOptions.map((item) => ({ label: item.name, value: item.id }))}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.projectId}>
                  <SelectValue placeholder="Selecciona proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjectOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId ? <p className="text-xs text-destructive">{errors.projectId}</p> : null}
              {filteredProjectOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Esta persona no tiene proyectos asignados como responsable.
                </p>
              ) : null}
            </div>
          ) : null}
          {activityType === "work" ? (
            <div className="grid gap-2">
              <Label>Obra</Label>
              <Select value={workId ?? EMPTY} onValueChange={(value) => setWorkId(value === EMPTY ? null : value)} items={workOptions.map((item) => ({ label: item.name, value: item.id }))}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.workId}>
                  <SelectValue placeholder="Selecciona obra" />
                </SelectTrigger>
                <SelectContent>
                  {workOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workId ? <p className="text-xs text-destructive">{errors.workId}</p> : null}
            </div>
          ) : null}
          {activityType === "project" ? (
            <div className="grid gap-2">
              <Label>Tarea</Label>
              <Select value={taskTypeId ?? EMPTY} onValueChange={(value) => setTaskTypeId(value === EMPTY ? null : value)} items={filteredTasks.map((item) => ({ label: item.name, value: item.id }))}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.taskTypeId}>
                  <SelectValue placeholder="Selecciona tarea" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTasks.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.taskTypeId ? <p className="text-xs text-destructive">{errors.taskTypeId}</p> : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Observación</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPen className="size-4" />}
            Guardar actividad
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PaymentSheet({
  open,
  onOpenChange,
  week,
  employee,
  payment,
  draft,
  paymentMethods,
  projectOptions,
  workOptions,
  taskTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: SalaryWeekWithRows | null;
  employee: Employee | null;
  payment: SalaryPaymentWithRelations | null;
  draft: SalaryPaymentDraft | null;
  paymentMethods: SalaryReport["paymentMethods"];
  projectOptions: SalaryOption[];
  workOptions: SalaryOption[];
  taskTypes: TaskType[];
}) {
  const [isPending, startTransition] = useTransition();
  const initialPaymentType = payment?.payment_type ?? draft?.paymentType ?? "week";
  const [paymentType, setPaymentType] = useState<SalaryPaymentType>(initialPaymentType);
  const [concept, setConcept] = useState(payment?.concept ?? draft?.concept ?? "");
  const [amount, setAmount] = useState(payment ? String(payment.amount) : draft ? String(draft.amount) : "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(payment?.payment_method_id ?? null);
  const [paymentDate, setPaymentDate] = useState(payment?.payment_date ?? week?.payment_date ?? "");
  const [projectId, setProjectId] = useState<string | null>(payment?.project_id ?? draft?.projectId ?? null);
  const [workId, setWorkId] = useState<string | null>(payment?.work_id ?? draft?.workId ?? null);
  const [taskTypeId, setTaskTypeId] = useState<string | null>(payment?.task_type_id ?? draft?.taskTypeId ?? null);
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredTasks = useMemo(() => {
    if (paymentType === "project") return taskTypes.filter((item) => item.module_type !== "work");
    if (paymentType === "work") return taskTypes.filter((item) => item.module_type !== "project");
    return taskTypes;
  }, [paymentType, taskTypes]);

  function submit() {
    if (!week || !employee) return;
    setErrors({});
    startTransition(async () => {
      const result = await saveSalaryPaymentAction({
        id: payment?.id ?? "",
        salaryWeekId: week.id,
        employeeId: employee.id,
        paymentType,
        concept,
        amount: money(amount),
        paymentMethodId,
        paymentDate,
        projectId: paymentType === "project" ? projectId : null,
        workId: paymentType === "work" ? workId : null,
        taskTypeId: paymentType === "project" ? taskTypeId : null,
        notes,
        status: "paid",
      });
      if (result.ok) {
        toast.success("Pago registrado");
        onOpenChange(false);
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Registrar pago</SheetTitle>
          <SheetDescription>{employee?.full_name} · semana {week?.week_start_date}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label>Tipo de pago</Label>
            <Select value={paymentType} onValueChange={(value) => setPaymentType((value ?? "week") as SalaryPaymentType)} items={SALARY_PAYMENT_TYPES.map((value) => ({ label: SALARY_PAYMENT_TYPE_LABELS[value], value }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALARY_PAYMENT_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {SALARY_PAYMENT_TYPE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} aria-invalid={!!errors.concept} />
            {errors.concept ? <p className="text-xs text-destructive">{errors.concept}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Monto</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} />
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label>Fecha de pago</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} aria-invalid={!!errors.paymentDate} />
              {errors.paymentDate ? <p className="text-xs text-destructive">{errors.paymentDate}</p> : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Forma de pago</Label>
            <Select value={paymentMethodId ?? EMPTY} onValueChange={(value) => setPaymentMethodId(value === EMPTY ? null : value)} items={paymentMethods.map((item) => ({ label: item.name, value: item.id }))}>
              <SelectTrigger className="w-full" aria-invalid={!!errors.paymentMethodId}>
                <SelectValue placeholder="Selecciona forma de pago" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paymentMethodId ? <p className="text-xs text-destructive">{errors.paymentMethodId}</p> : null}
          </div>
          {paymentType === "project" ? (
            <div className="grid gap-2">
              <Label>Proyecto</Label>
              <Select value={projectId ?? EMPTY} onValueChange={(value) => setProjectId(value === EMPTY ? null : value)} items={projectOptions.map((item) => ({ label: item.name, value: item.id }))}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.projectId}>
                  <SelectValue placeholder="Selecciona proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId ? <p className="text-xs text-destructive">{errors.projectId}</p> : null}
            </div>
          ) : null}
          {paymentType === "work" ? (
            <div className="grid gap-2">
              <Label>Obra</Label>
              <Select value={workId ?? EMPTY} onValueChange={(value) => setWorkId(value === EMPTY ? null : value)} items={workOptions.map((item) => ({ label: item.name, value: item.id }))}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.workId}>
                  <SelectValue placeholder="Selecciona obra" />
                </SelectTrigger>
                <SelectContent>
                  {workOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workId ? <p className="text-xs text-destructive">{errors.workId}</p> : null}
            </div>
          ) : null}
          {paymentType === "project" ? (
            <div className="grid gap-2">
              <Label>Tarea</Label>
              <Select value={taskTypeId ?? EMPTY} onValueChange={(value) => setTaskTypeId(value === EMPTY ? null : value)} items={filteredTasks.map((item) => ({ label: item.name, value: item.id }))}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.taskTypeId}>
                  <SelectValue placeholder="Selecciona tarea" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTasks.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.taskTypeId ? <p className="text-xs text-destructive">{errors.taskTypeId}</p> : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Observación</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
            Guardar pago
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmployeeDetailSheet({
  open,
  onOpenChange,
  week,
  employeeSummary,
  projectOptions,
  taskRates,
  paymentMethods,
  onNewPayment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: SalaryWeekWithRows | null;
  employeeSummary: SalaryWeekWithRows["employees"][number] | null;
  projectOptions: SalaryProjectOption[];
  taskRates: SalaryReport["taskRates"];
  paymentMethods: SalaryReport["paymentMethods"];
  onNewPayment: (draft?: SalaryPaymentDraft | null) => void;
}) {
  const router = useRouter();
  const [activePaymentKey, setActivePaymentKey] = useState<string | null>(null);
  const [inlineAmount, setInlineAmount] = useState("");
  const [inlineMethodId, setInlineMethodId] = useState<string | null>(null);
  const [paidKeys, setPaidKeys] = useState<Set<string>>(() => new Set());
  const [optimisticPayments, setOptimisticPayments] = useState<SalaryPaymentWithRelations[]>([]);
  const [isInlinePending, startInlineTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  function deletePayment(payment: SalaryPaymentWithRelations) {
    startDeleteTransition(async () => {
      const result = await deleteSalaryPaymentAction({ paymentId: payment.id });
      if (result.ok) {
        setOptimisticPayments((current) => current.filter((item) => item.id !== payment.id));
        setPaidKeys(new Set());
        setActivePaymentKey(null);
        toast.success("Pago eliminado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const groupedWork = useMemo(() => {
    if (!employeeSummary) return [];
    const employeeId = employeeSummary.employee.id;
    const globalTaskRates = new Map<string, number>();
    const employeeTaskRates = new Map<string, number>();
    for (const rate of taskRates) {
      if (rate.employeeId === null) {
        globalTaskRates.set(rate.taskTypeId, rate.amount);
      } else if (rate.employeeId === employeeId) {
        employeeTaskRates.set(rate.taskTypeId, rate.amount);
      }
    }

    const groups = new Map<
      string,
      {
        key: string;
        type: "project" | "work";
        referenceId: string;
        referenceName: string;
        clientName: string | null;
        taskName: string;
        taskTypeId: string | null;
        days: number;
        dates: string[];
        budget: number | null;
        source: "project" | "employee-rate" | "global-rate" | "none";
      }
    >();

    for (const record of Object.values(employeeSummary.dayRecords)) {
      if (!record) continue;
      if (record.activity_type !== "project" && record.activity_type !== "work") continue;
      const reference = record.activity_type === "project" ? record.project : record.work;
      if (!reference) continue;
      const referenceName = reference.name;
      const clientName = record.activity_type === "project"
        ? projectOptions.find((item) => item.id === reference.id)?.clientName ?? null
        : null;
      const taskName = record.taskType?.name ?? "Obra";
      const taskTypeId = record.taskType?.id ?? null;
      const key = `${record.activity_type}:${reference.id}:${taskTypeId ?? "general"}`;
      const projectOption = record.activity_type === "project" ? projectOptions.find((item) => item.id === reference.id) : null;
      const projectBudget =
        record.activity_type === "project"
          ? projectOption?.taskBudgets[taskName] ?? null
          : null;
      const fallbackBudget =
        (taskTypeId ? employeeTaskRates.get(taskTypeId) : undefined) ??
        (taskTypeId ? globalTaskRates.get(taskTypeId) : undefined) ??
        null;
      const budget = projectBudget ?? fallbackBudget;
      const current = groups.get(key) ?? {
        key,
        type: record.activity_type,
        referenceId: reference.id,
        referenceName,
        clientName,
        taskName,
        taskTypeId,
        days: 0,
        dates: [] as string[],
        budget,
        source: projectBudget !== null ? "project" : fallbackBudget !== null ? (taskTypeId && employeeTaskRates.has(taskTypeId) ? "employee-rate" : "global-rate") : "none",
      };
      current.days += 1;
      current.dates.push(record.work_date);
      if (current.budget === null && budget !== null) current.budget = budget;
      groups.set(key, current);
    }

    return [...groups.values()]
      .sort((a, b) => {
        const byType = a.type.localeCompare(b.type);
        if (byType !== 0) return byType;
        return a.referenceName.localeCompare(b.referenceName);
      })
      .map((item) => ({
        ...item,
        dates: item.dates.sort(),
        suggestedPerDay: item.budget !== null ? round2(item.budget / item.days) : null,
      }));
  }, [employeeSummary, projectOptions, taskRates]);

  const totalEstimated = useMemo(
    () => round2(groupedWork.reduce((sum, item) => sum + (item.budget ?? 0), 0)),
    [groupedWork],
  );
  const paymentHistory = useMemo(
    () => {
      const basePayments = employeeSummary?.payments ?? [];
      const basePaymentIds = new Set(basePayments.map((payment) => payment.id));
      const activeOptimisticPayments = optimisticPayments.filter(
        (payment) =>
          payment.salary_week_id === week?.id &&
          payment.employee_id === employeeSummary?.employee.id &&
          !basePaymentIds.has(payment.id),
      );

      return [...basePayments, ...activeOptimisticPayments].sort((a, b) =>
        a.payment_date.localeCompare(b.payment_date),
      );
    },
    [employeeSummary?.employee.id, employeeSummary?.payments, optimisticPayments, week?.id],
  );
  const paymentSummary = useMemo(() => {
    const caja = paymentHistory
      .filter((payment) => payment.method?.name.toLowerCase() === "caja")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const cuentaRosa = paymentHistory
      .filter((payment) => payment.method?.name.toLowerCase() === "cuenta de rosa")
      .reduce((sum, payment) => sum + payment.amount, 0);

    return {
      caja: round2(caja),
      cuentaRosa: round2(cuentaRosa),
      total: round2(caja + cuentaRosa),
    };
  }, [paymentHistory]);

  // Comprobantes de pago: un recibo por proyecto/obra trabajado en la semana
  // (suma todas las tareas/días dentro del mismo proyecto u obra).
  const receiptGroups = useMemo(() => {
    return salaryReceiptGroups(paymentHistory);
  }, [paymentHistory]);

  function openInlinePayment(item: (typeof groupedWork)[number]) {
    setActivePaymentKey((current) => (current === item.key ? null : item.key));
    const paidTotal = matchingPaymentTotal(item);
    const remaining = item.budget !== null ? Math.max(round2(item.budget - paidTotal), 0) : null;
    setInlineAmount(remaining !== null ? String(remaining) : "");
    setInlineMethodId(null);
  }

  // Amount already settled for this project area via the project's own expense
  // movements (e.g. paid directly in the project, or synced from a prior week).
  function externalPaid(item: (typeof groupedWork)[number]) {
    if (item.type !== "project") return 0;
    const option = projectOptions.find((project) => project.id === item.referenceId);
    return option?.taskPaid[item.taskName] ?? 0;
  }

  function matchingPaymentTotal(item: (typeof groupedWork)[number]) {
    if (!employeeSummary) return 0;
    const thisWeek = paymentHistory
      .filter((payment) => {
        const sameReference =
          item.type === "project"
            ? payment.project_id === item.referenceId
            : payment.work_id === item.referenceId;
        return (
          payment.payment_type === item.type &&
          sameReference &&
          payment.task_type_id === item.taskTypeId
        );
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
    // This week's salary payments aren't synced to project expenses until the
    // week is closed, so adding both never double-counts a draft week.
    return round2(thisWeek + externalPaid(item));
  }

  function registerInlinePayment(item: (typeof groupedWork)[number]) {
    if (!week || !employeeSummary) return;
    const amount = money(inlineAmount);
    const paidTotal = matchingPaymentTotal(item);
    const remaining = item.budget !== null ? Math.max(round2(item.budget - paidTotal), 0) : null;
    if (remaining !== null && amount > remaining + 0.001) {
      toast.error(`El monto supera el disponible: ${formatCurrency(remaining)}`);
      return;
    }
    startInlineTransition(async () => {
      const result = await saveSalaryPaymentAction({
        id: "",
        salaryWeekId: week.id,
        employeeId: employeeSummary.employee.id,
        paymentType: item.type,
        concept: item.taskName,
        amount,
        paymentMethodId: inlineMethodId,
        paymentDate: week.payment_date,
        projectId: item.type === "project" ? item.referenceId : null,
        workId: item.type === "work" ? item.referenceId : null,
        taskTypeId: item.taskTypeId,
        notes: "",
        status: "paid",
      });
      if (result.ok) {
        const method = paymentMethods.find((paymentMethod) => paymentMethod.id === inlineMethodId) ?? null;
        setOptimisticPayments((current) => [
          ...current,
          {
            id: result.data.paymentId,
            salary_week_id: week.id,
            employee_id: employeeSummary.employee.id,
            payment_type: item.type,
            concept: item.taskName,
            amount,
            payment_method_id: inlineMethodId ?? "",
            payment_date: week.payment_date,
            project_id: item.type === "project" ? item.referenceId : null,
            work_id: item.type === "work" ? item.referenceId : null,
            task_type_id: item.taskTypeId,
            notes: null,
            status: "paid",
            created_at: new Date().toISOString(),
            created_by: null,
            employee: employeeSummary.employee,
            method,
            project:
              item.type === "project"
                ? { id: item.referenceId, name: item.referenceName } as SalaryPaymentWithRelations["project"]
                : null,
            work:
              item.type === "work"
                ? { id: item.referenceId, name: item.referenceName } as SalaryPaymentWithRelations["work"]
                : null,
            taskType: item.taskTypeId
              ? { id: item.taskTypeId, name: item.taskName } as SalaryPaymentWithRelations["taskType"]
              : null,
          },
        ]);
        setPaidKeys((current) => new Set(current).add(item.key));
        setActivePaymentKey(null);
        toast.success("Pago registrado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:!w-[min(46vw,860px)] sm:!max-w-none">
        <SheetHeader>
          <SheetTitle>{employeeSummary?.employee.full_name ?? "Empleado"}</SheetTitle>
          <SheetDescription>
            {week ? `${formatDate(week.week_start_date)} - ${formatDate(week.week_end_date)}` : "Detalle semanal"}
          </SheetDescription>
        </SheetHeader>
        {employeeSummary ? (
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Tipo base</p>
                <p className="mt-1 font-semibold">
                  {EMPLOYEE_DEFAULT_WORK_TYPE_LABELS[employeeSummary.employee.default_work_type]}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Trabajos registrados</p>
                <p className="mt-1 font-semibold text-brand-foreground">
                  {groupedWork.length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Presupuesto estimado</p>
                <p className="mt-1 font-semibold">{formatCurrency(totalEstimated)}</p>
              </Card>
            </div>

            <Card className="gap-0 overflow-hidden p-0">
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Trabajos y presupuesto</h3>
                    <p className="text-sm text-muted-foreground">Resumen por proyecto u obra con días trabajados y monto estimado.</p>
                  </div>
                  <Button size="sm" onClick={() => onNewPayment()}>
                    <Plus className="size-4" />
                    Registrar pago
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-4">Referencia</TableHead>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedWork.map((item) => {
                    const paidTotal = matchingPaymentTotal(item);
                    const remaining = item.budget !== null ? Math.max(round2(item.budget - paidTotal), 0) : null;
                    const isPaid = remaining !== null ? remaining <= 0.001 : paidTotal > 0 || paidKeys.has(item.key);
                    const hasPartialPayment = paidTotal > 0 && !isPaid;
                    const isOpen = activePaymentKey === item.key;
                    const displayedPayment = paidTotal > 0 ? paidTotal : paidKeys.has(item.key) ? money(inlineAmount) : null;
                    const inlineAmountValue = money(inlineAmount);
                    const inlineExceedsRemaining =
                      isOpen && remaining !== null && inlineAmountValue > remaining + 0.001;

                    return (
                      <Fragment key={item.key}>
                        <TableRow
                          className={cn(
                            "border-l-4",
                            isPaid ? "border-l-brand bg-brand/5" : "border-l-transparent",
                          )}
                        >
                          <TableCell className="px-4">
                            <div className="font-medium">{item.referenceName}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.clientName ? item.clientName : item.type === "work" ? "Obra" : "Proyecto"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{item.taskName}</div>
                            <div className="mt-1 grid w-fit grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              {item.dates.map((date) => (
                                <span key={date} className="whitespace-nowrap tabular-nums">
                                  {formatDate(date)}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold tabular-nums">{item.days}</TableCell>
                          <TableCell className="font-semibold tabular-nums">
                            {currencyOrDash(item.budget)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            <div>{currencyOrDash(displayedPayment)}</div>
                            {remaining !== null && remaining > 0.001 ? (
                              <div className="text-xs font-medium text-amber-600">
                                Falta {formatCurrency(remaining)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const status =
                                item.budget === null
                                  ? paidTotal > 0.001
                                    ? { label: "Registrado", tone: "bg-brand-muted text-brand-foreground" }
                                    : { label: "Sin reconocer", tone: "bg-amber-100 text-amber-800" }
                                  : isPaid
                                    ? { label: "Completo", tone: "bg-brand-muted text-brand-foreground" }
                                    : paidTotal > 0.001
                                      ? { label: "Parcial", tone: "bg-sky-100 text-sky-700" }
                                      : { label: "Sin reconocer", tone: "bg-amber-100 text-amber-800" };
                              return (
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                    status.tone,
                                  )}
                                >
                                  {status.label}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={isPaid ? "secondary" : "outline"}
                              onClick={() => openInlinePayment(item)}
                              disabled={isPaid || (item.type === "project" && item.budget === null)}
                            >
                              <ReceiptText className="size-4" />
                              {isPaid ? "Pagado" : hasPartialPayment ? "Abonar" : "Pagar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isOpen ? (
                          <TableRow className="bg-brand/5 hover:bg-brand/5">
                            <TableCell colSpan={7} className="px-4 py-3">
                              <div className="grid gap-3 rounded-xl border border-brand/20 bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
                                <div className="grid gap-2">
                                  <Label>Monto a pagar</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={remaining ?? undefined}
                                    step="0.01"
                                    value={inlineAmount}
                                    aria-invalid={inlineExceedsRemaining}
                                    onChange={(event) => setInlineAmount(event.target.value)}
                                  />
                                  {inlineExceedsRemaining ? (
                                    <p className="text-xs text-destructive">
                                      Máximo disponible: {formatCurrency(remaining ?? 0)}
                                    </p>
                                  ) : remaining !== null ? (
                                    <p className="text-xs text-muted-foreground">
                                      Disponible: {formatCurrency(remaining)}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Monto libre · honorario de obra
                                    </p>
                                  )}
                                </div>
                                <div className="grid gap-2">
                                  <Label>Forma de pago</Label>
                                  <Select
                                    value={inlineMethodId ?? EMPTY}
                                    onValueChange={(value) => setInlineMethodId(value === EMPTY ? null : value)}
                                    items={paymentMethods.map((method) => ({ label: method.name, value: method.id }))}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Selecciona cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {paymentMethods.map((method) => (
                                        <SelectItem key={method.id} value={method.id}>
                                          {method.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2 sm:pt-6">
                                  <Button
                                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                                    onClick={() => registerInlinePayment(item)}
                                    disabled={isInlinePending || inlineExceedsRemaining || inlineAmountValue <= 0 || !inlineMethodId}
                                  >
                                    {isInlinePending ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
                                    Registrar
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {groupedWork.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                        No hay proyectos u obras registrados para este empleado en la semana.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Card>

            <Card className="gap-0 overflow-hidden p-0">
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Historial de pagos</h3>
                    <p className="text-sm text-muted-foreground">
                      Pagos registrados para esta persona durante la semana.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total registrado</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(paymentSummary.total)}</p>
                  </div>
                </div>
              </div>
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-4">Fecha</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Forma de pago</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="px-4 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="px-4">{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {payment.project?.name ?? payment.work?.name ?? "Pago semanal"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {SALARY_PAYMENT_TYPE_LABELS[payment.payment_type]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{payment.concept}</div>
                        <div className="text-xs text-muted-foreground">
                          {payment.taskType?.name ?? "Sin tarea"}
                        </div>
                      </TableCell>
                      <TableCell>{payment.method?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar pago"
                          disabled={isDeletePending}
                          onClick={() => deletePayment(payment)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paymentHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                        Todavía no hay pagos registrados para esta persona.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow className="bg-brand/10 hover:bg-brand/10">
                    <TableCell colSpan={4} className="px-4 font-medium">
                      Total Caja
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                      {formatCurrency(paymentSummary.caja)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className="bg-brand/10 hover:bg-brand/10">
                    <TableCell colSpan={4} className="px-4 font-medium">
                      Total Cuenta de Rosa
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-brand-foreground">
                      {formatCurrency(paymentSummary.cuentaRosa)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </Card>

            {week && employeeSummary && receiptGroups.length > 0 ? (
              <Card className="gap-0 overflow-hidden p-0">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Comprobantes de pago</h3>
                  <p className="text-sm text-muted-foreground">
                    Un comprobante por cada proyecto u obra trabajado esta semana.
                  </p>
                </div>
                <div className="divide-y">
                  {receiptGroups.map((g) => (
                    <div
                      key={`${g.kind}:${g.refId}`}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{g.name}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {g.kind === "obra" ? "Obra" : "Proyecto"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-semibold tabular-nums">{formatCurrency(g.amount)}</span>
                        <a
                          href={`/comprobante/${g.kind}/${week.id}/${employeeSummary.employee.id}/${g.refId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                          title="Imprimir comprobante"
                        >
                          <Printer className="size-3.5" /> Comprobante
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// Worked project/work buckets for an employee in the week (one per reference+task).
function employeeWorkGroups(
  employeeSummary: SalaryWeekWithRows["employees"][number],
) {
  const map = new Map<
    string,
    {
      type: "project" | "work";
      referenceId: string;
      referenceName: string;
      taskName: string;
      taskTypeId: string | null;
    }
  >();
  for (const record of Object.values(employeeSummary.dayRecords)) {
    if (!record) continue;
    if (record.activity_type !== "project" && record.activity_type !== "work") continue;
    const reference = record.activity_type === "project" ? record.project : record.work;
    if (!reference) continue;
    const taskTypeId = record.taskType?.id ?? null;
    const key = `${record.activity_type}:${reference.id}:${taskTypeId ?? "general"}`;
    map.set(key, {
      type: record.activity_type,
      referenceId: reference.id,
      referenceName: reference.name,
      taskName: record.taskType?.name ?? "Obra",
      taskTypeId,
    });
  }
  return [...map.values()];
}

// Amount recognized for a group: this week's salary payments + amounts already
// settled in the project itself (for project areas).
function groupPaidTotal(
  group: {
    type: "project" | "work";
    referenceId: string;
    taskName: string;
    taskTypeId: string | null;
  },
  payments: SalaryPaymentWithRelations[],
  projectOptions: SalaryProjectOption[],
) {
  const thisWeek = payments
    .filter((payment) => {
      const sameReference =
        group.type === "project"
          ? payment.project_id === group.referenceId
          : payment.work_id === group.referenceId;
      return (
        payment.payment_type === group.type &&
        sameReference &&
        payment.task_type_id === group.taskTypeId
      );
    })
    .reduce((sum, payment) => sum + payment.amount, 0);
  const external =
    group.type === "project"
      ? projectOptions.find((option) => option.id === group.referenceId)?.taskPaid[group.taskName] ?? 0
      : 0;
  return round2(thisWeek + external);
}

// A worked project/work must have at least one recognized payment before the
// week can be closed. Returns how many of an employee's buckets are still empty.
function employeeReadiness(
  employeeSummary: SalaryWeekWithRows["employees"][number],
  projectOptions: SalaryProjectOption[],
) {
  const groups = employeeWorkGroups(employeeSummary);
  const pending = groups.filter(
    (group) => groupPaidTotal(group, employeeSummary.payments, projectOptions) <= 0.001,
  );
  return { total: groups.length, pending: pending.length, ready: pending.length === 0 };
}

function WeekCard({
  week,
  projectOptions,
  onEditWeek,
  onOpenActivity,
  onOpenEmployee,
  onStatusChange,
}: {
  week: SalaryWeekWithRows;
  projectOptions: SalaryProjectOption[];
  onEditWeek: (week: SalaryWeekWithRows) => void;
  onOpenActivity: (
    week: SalaryWeekWithRows,
    employee: Employee,
    day: SalaryWeekday,
    record: SalaryDayRecordWithRelations | null,
  ) => void;
  onOpenEmployee: (
    week: SalaryWeekWithRows,
    employeeSummary: SalaryWeekWithRows["employees"][number],
  ) => void;
  onStatusChange: (week: SalaryWeekWithRows, status: SalaryWeekStatus) => void;
}) {
  const readinessByEmployee = week.employees.map((row) => ({
    row,
    readiness: employeeReadiness(row, projectOptions),
  }));
  const pendingTotal = readinessByEmployee.reduce((sum, item) => sum + item.readiness.pending, 0);
  const recognizedTotal = readinessByEmployee.reduce(
    (sum, item) => sum + (item.readiness.total - item.readiness.pending),
    0,
  );
  const groupsTotal = readinessByEmployee.reduce((sum, item) => sum + item.readiness.total, 0);
  const allReady = pendingTotal === 0;
  const isClosed = week.status === "paid";

  return (
    <div className="flex flex-col gap-5">
      {/* 1 · Resumen y estado de la semana */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">
                Semana {formatDate(week.week_start_date)} - {formatDate(week.week_end_date)}
              </h2>
              <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusTone(week.status))}>
                {SALARY_WEEK_STATUS_LABELS[week.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pago previsto {formatDate(week.payment_date)} · Total {formatCurrency(week.totals.total)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isClosed ? (
              <Button variant="outline" size="sm" onClick={() => onEditWeek(week)}>
                <ClipboardPen className="size-4" />
                Editar semana
              </Button>
            ) : null}
            {!isClosed ? (
              <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={() => onStatusChange(week, "paid")}>
                <WalletCards className="size-4" />
                Marcar pagada
              </Button>
            ) : null}
          </div>
        </div>
        {!isClosed && groupsTotal > 0 ? (
          <div
            className={cn(
              "mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
              allReady
                ? "border-brand/30 bg-brand/5 text-brand-foreground"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              {allReady
                ? `Listo para cerrar: los ${groupsTotal} trabajos de la semana tienen un pago reconocido.`
                : `Faltan ${pendingTotal} de ${groupsTotal} trabajos por reconocer un pago. Un pago parcial es suficiente; no se permite cerrar dejando un trabajo sin nada.`}
            </span>
          </div>
        ) : null}
      </Card>

      {/* 2 · Actividades de la semana (calendario) */}
      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        <div className="border-b px-5 py-4">
          <h3 className="font-semibold">Actividades de la semana</h3>
          <p className="text-sm text-muted-foreground">
            Toca una celda para asignar proyecto, obra o ausencia por día.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="min-w-28 px-4">Días</TableHead>
                {week.employees.map((row) => (
                  <TableHead key={row.employee.id} className="min-w-44 px-4 align-top">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onOpenEmployee(week, row)}
                    >
                      <div className="font-medium">{row.employee.full_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {EMPLOYEE_DEFAULT_WORK_TYPE_LABELS[row.employee.default_work_type]}
                      </div>
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {WEEKDAYS.map((day) => (
                <TableRow key={day}>
                  <TableCell className="px-4 font-medium">{SALARY_WEEKDAY_LABELS[day]}</TableCell>
                  {week.employees.map((employeeRow) => {
                    const record = employeeRow.dayRecords[day] ?? null;
                    return (
                      <TableCell key={employeeRow.employee.id} className="px-4 align-top">
                        <button
                          type="button"
                          className={cn(
                            "w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/40",
                            record ? "border-border" : "border-dashed border-border",
                          )}
                          onClick={() => onOpenActivity(week, employeeRow.employee, day, record)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                activityTone(record?.activity_type ?? "pending"),
                              )}
                            >
                              {SALARY_ASSIGNMENT_LABELS[record?.activity_type ?? "pending"]}
                            </span>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {recordLabel(record)}
                          </div>
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 3 · Pagos por empleado */}
      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        <div className="border-b px-5 py-4">
          <h3 className="font-semibold">Pagos por empleado</h3>
          <p className="text-sm text-muted-foreground">
            {recognizedTotal} de {groupsTotal} trabajos con pago reconocido. Abre cada empleado para registrar montos.
          </p>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="px-5">Empleado</TableHead>
              <TableHead className="text-right">Caja</TableHead>
              <TableHead className="text-right">Cuenta de Rosa</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="px-5 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readinessByEmployee.map(({ row, readiness }) => {
              const status =
                readiness.total === 0
                  ? { label: "Sin actividad", tone: "bg-muted text-muted-foreground" }
                  : readiness.ready
                    ? { label: "Reconocido", tone: "bg-brand-muted text-brand-foreground" }
                    : { label: `Faltan ${readiness.pending}`, tone: "bg-amber-100 text-amber-800" };
              return (
                <TableRow key={row.employee.id}>
                  <TableCell className="px-5">
                    <div className="font-medium">{row.employee.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {EMPLOYEE_DEFAULT_WORK_TYPE_LABELS[row.employee.default_work_type]}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {paidCurrencyOrDash(row.totals.cash)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {paidCurrencyOrDash(row.totals.account)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {paidCurrencyOrDash(row.totals.total)}
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", status.tone)}>
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    <Button size="sm" variant="outline" onClick={() => onOpenEmployee(week, row)}>
                      <ReceiptText className="size-4" />
                      Gestionar pagos
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function SalaryWeekDetailView({
  week,
  projectOptions,
  workOptions,
  taskTypes,
  taskRates,
  paymentMethods,
}: {
  week: SalaryWeekWithRows;
  projectOptions: SalaryProjectOption[];
  workOptions: SalaryOption[];
  taskTypes: TaskType[];
  taskRates: SalaryReport["taskRates"];
  paymentMethods: SalaryReport["paymentMethods"];
}) {
  const [weekSheetOpen, setWeekSheetOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState<SalaryWeekWithRows | null>(null);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const [activityContext, setActivityContext] = useState<{
    week: SalaryWeekWithRows | null;
    employee: Employee | null;
    day: SalaryWeekday | null;
    record: SalaryDayRecordWithRelations | null;
  }>({ week: null, employee: null, day: null, record: null });
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{
    week: SalaryWeekWithRows | null;
    employee: Employee | null;
    payment: SalaryPaymentWithRelations | null;
    draft: SalaryPaymentDraft | null;
  }>({ week: null, employee: null, payment: null, draft: null });
  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false);
  const [employeeContext, setEmployeeContext] = useState<{
    week: SalaryWeekWithRows | null;
    row: SalaryWeekWithRows["employees"][number] | null;
  }>({ week: null, row: null });
  const [isStatusPending, startStatusTransition] = useTransition();

  function openEditWeek(nextWeek: SalaryWeekWithRows) {
    setEditingWeek(nextWeek);
    setWeekSheetOpen(true);
  }

  function openActivity(
    nextWeek: SalaryWeekWithRows,
    employee: Employee,
    day: SalaryWeekday,
    record: SalaryDayRecordWithRelations | null,
  ) {
    setActivityContext({ week: nextWeek, employee, day, record });
    setActivitySheetOpen(true);
  }

  function openPayment(
    nextWeek: SalaryWeekWithRows,
    employee: Employee,
    payment: SalaryPaymentWithRelations | null = null,
    draft: SalaryPaymentDraft | null = null,
  ) {
    setPaymentContext({ week: nextWeek, employee, payment, draft });
    setPaymentSheetOpen(true);
  }

  function openEmployeeDetail(
    nextWeek: SalaryWeekWithRows,
    row: SalaryWeekWithRows["employees"][number],
  ) {
    setEmployeeContext({ week: nextWeek, row });
    setEmployeeSheetOpen(true);
  }

  function changeStatus(nextWeek: SalaryWeekWithRows, status: SalaryWeekStatus) {
    startStatusTransition(async () => {
      const result = await updateSalaryWeekStatusAction({
        salaryWeekId: nextWeek.id,
        status,
      });
      if (result.ok) {
        toast.success(`Semana marcada como ${SALARY_WEEK_STATUS_LABELS[status].toLowerCase()}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <WeekCard
        week={week}
        projectOptions={projectOptions}
        onEditWeek={openEditWeek}
        onOpenActivity={openActivity}
        onOpenEmployee={openEmployeeDetail}
        onStatusChange={changeStatus}
      />
      <WeekSheet open={weekSheetOpen} onOpenChange={setWeekSheetOpen} week={editingWeek} />
      <ActivitySheet
        open={activitySheetOpen}
        onOpenChange={setActivitySheetOpen}
        week={activityContext.week}
        employee={activityContext.employee}
        day={activityContext.day}
        record={activityContext.record}
        projectOptions={projectOptions}
        workOptions={workOptions}
        taskTypes={taskTypes}
      />
      <PaymentSheet
        key={[
          paymentContext.payment?.id ?? "new",
          paymentContext.employee?.id ?? "none",
          paymentContext.draft?.paymentType ?? "empty",
          paymentContext.draft?.projectId ?? "",
          paymentContext.draft?.workId ?? "",
          paymentContext.draft?.taskTypeId ?? "",
        ].join(":")}
        open={paymentSheetOpen}
        onOpenChange={setPaymentSheetOpen}
        week={paymentContext.week}
        employee={paymentContext.employee}
        payment={paymentContext.payment}
        draft={paymentContext.draft}
        paymentMethods={paymentMethods}
        projectOptions={projectOptions}
        workOptions={workOptions}
        taskTypes={taskTypes}
      />
      <EmployeeDetailSheet
        open={employeeSheetOpen}
        onOpenChange={setEmployeeSheetOpen}
        week={employeeContext.week}
        employeeSummary={employeeContext.row}
        projectOptions={projectOptions}
        taskRates={taskRates}
        paymentMethods={paymentMethods}
        onNewPayment={(draft) => {
          if (!employeeContext.week || !employeeContext.row) return;
          setEmployeeSheetOpen(false);
          openPayment(employeeContext.week, employeeContext.row.employee, null, draft ?? null);
        }}
      />
      {isStatusPending ? <span className="sr-only">Actualizando estado</span> : null}
    </>
  );
}

function SalaryReceiptsSheet({
  open,
  onOpenChange,
  week,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: SalaryWeekWithRows | null;
}) {
  const employeesWithReceipts = useMemo(
    () =>
      week?.employees.map((row) => ({
        row,
        receipts: salaryReceiptGroups(row.payments),
      })) ?? [],
    [week],
  );
  const totalReceipts = employeesWithReceipts.reduce((sum, item) => sum + item.receipts.length, 0);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    employeeId: string;
    employeeName: string;
    receipt: SalaryReceiptGroup;
  } | null>(null);
  const [receiptPreviewLoading, setReceiptPreviewLoading] = useState(false);

  const selectedUrl =
    week && selectedReceipt
      ? `/comprobante/${selectedReceipt.receipt.kind}/${week.id}/${selectedReceipt.employeeId}/${selectedReceipt.receipt.refId}?preview=1`
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:!w-[min(92vw,1180px)] sm:!max-w-none">
        <SheetHeader>
          <SheetTitle>Comprobantes de pago</SheetTitle>
          <SheetDescription>
            {week
              ? `${formatDate(week.week_start_date)} - ${formatDate(week.week_end_date)} · ${totalReceipts} comprobante${totalReceipts === 1 ? "" : "s"}`
              : "Selecciona una semana para revisar sus comprobantes."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 lg:grid-cols-[380px_1fr]">
          <div className="min-h-0 overflow-hidden rounded-xl border">
            <div className="border-b bg-muted/30 px-4 py-3">
              <h3 className="font-semibold">Empleados</h3>
              <p className="text-sm text-muted-foreground">
                Abre un empleado y selecciona un comprobante.
              </p>
            </div>
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto divide-y">
              {employeesWithReceipts.map(({ row, receipts }) => {
                const expanded = expandedEmployeeId === row.employee.id;
                return (
                  <div key={row.employee.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                      onClick={() => setExpandedEmployeeId(expanded ? null : row.employee.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.employee.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {receipts.length} comprobante{receipts.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          expanded ? "rotate-90" : "",
                        )}
                      />
                    </button>
                    {expanded ? (
                      <div className="bg-muted/20 px-3 pb-3">
                        {receipts.length > 0 ? (
                          <div className="grid gap-2">
                            {receipts.map((receipt) => {
                              const selected =
                                selectedReceipt?.employeeId === row.employee.id &&
                                selectedReceipt.receipt.kind === receipt.kind &&
                                selectedReceipt.receipt.refId === receipt.refId;
                              return (
                                <button
                                  key={`${receipt.kind}:${receipt.refId}`}
                                  type="button"
                                  className={cn(
                                    "rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent",
                                    selected ? "border-brand bg-brand/10" : "",
                                  )}
                                  onClick={() => {
                                    setReceiptPreviewLoading(true);
                                    setSelectedReceipt({
                                      employeeId: row.employee.id,
                                      employeeName: row.employee.full_name,
                                      receipt,
                                    });
                                  }}
                                >
                                  <span className="flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-medium">{receipt.name}</span>
                                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                        {receipt.kind === "obra" ? "Obra" : "Proyecto"}
                                      </span>
                                    </span>
                                    <span className="shrink-0 font-semibold tabular-nums">
                                      {formatCurrency(receipt.amount)}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                            Este empleado todavía no tiene comprobantes.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {employeesWithReceipts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay empleados en esta semana.
                </p>
              ) : null}
            </div>
          </div>

          <div className="min-h-[520px] overflow-hidden rounded-xl border bg-background">
            {selectedUrl && selectedReceipt ? (
              <div className="flex h-full min-h-[520px] flex-col">
                <div className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selectedReceipt.receipt.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedReceipt.employeeName} · {formatCurrency(selectedReceipt.receipt.amount)}
                    </p>
                  </div>
                  <a
                    href={selectedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <Eye className="size-4" />
                    Abrir vista
                  </a>
                </div>
                <div className="relative min-h-0 flex-1 bg-muted/20">
                  {receiptPreviewLoading ? <ReceiptPreviewSkeleton /> : null}
                  <iframe
                    key={selectedUrl}
                    title={`Comprobante de ${selectedReceipt.employeeName}`}
                    src={selectedUrl}
                    className={cn(
                      "absolute inset-0 size-full bg-white transition-opacity duration-200",
                      receiptPreviewLoading ? "opacity-0" : "opacity-100",
                    )}
                    onLoad={() => setReceiptPreviewLoading(false)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <ReceiptText className="size-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">Selecciona un comprobante</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Primero abre un empleado y luego elige uno de sus comprobantes para ver la versión imprimible.
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReceiptPreviewSkeleton() {
  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-hidden bg-muted/20 p-8">
      <div className="w-full max-w-[720px] animate-pulse rounded-[28px] border-2 border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-36 rounded-full bg-muted" />
          <div className="h-7 w-64 rounded-md bg-muted" />
          <div className="ml-auto h-11 w-36 rounded-lg bg-muted" />
        </div>

        <div className="mt-10 grid gap-7">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-end gap-4">
              <div className="h-5 w-36 rounded bg-muted" />
              <div className="h-6 flex-1 border-b border-border">
                <div className="h-5 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-end gap-3">
          <div className="h-5 w-6 rounded bg-muted" />
          <div className="h-6 w-16 border-b border-border">
            <div className="h-5 w-10 rounded bg-muted" />
          </div>
          <div className="h-5 w-6 rounded bg-muted" />
          <div className="h-6 w-32 border-b border-border">
            <div className="h-5 w-24 rounded bg-muted" />
          </div>
          <div className="h-5 w-10 rounded bg-muted" />
          <div className="h-6 w-16 border-b border-border">
            <div className="h-5 w-10 rounded bg-muted" />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 items-end gap-8">
          <div className="h-16 rounded-lg bg-muted" />
          <div className="grid gap-2">
            <div className="mx-auto h-3 w-40 rounded bg-muted" />
            <div className="mx-auto h-3 w-32 rounded bg-muted" />
            <div className="mx-auto h-3 w-36 rounded bg-muted" />
          </div>
          <div className="h-8 border-b border-border" />
        </div>
      </div>
    </div>
  );
}

export function SalaryView({
  report,
}: {
  report: SalaryReport;
  projectOptions: SalaryProjectOption[];
  workOptions: SalaryOption[];
}) {
  const [weekSheetOpen, setWeekSheetOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState<SalaryWeekWithRows | null>(null);
  const [receiptsWeek, setReceiptsWeek] = useState<SalaryWeekWithRows | null>(null);

  function openCreateWeek() {
    setEditingWeek(null);
    setWeekSheetOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pagado del mes"
          value={formatCurrency(report.totals.totalPaid)}
          hint={`${report.weeks.length} semana${report.weeks.length === 1 ? "" : "s"} visibles`}
          icon={<WalletCards className="size-5" />}
          accent
        />
        <Metric
          label="Pendiente"
          value={formatCurrency(report.totals.totalPending)}
          hint="Pagos pendientes u observados"
          icon={<ShieldCheck className="size-5" />}
          tone="danger"
        />
        <Metric
          label="Proyectos"
          value={formatCurrency(report.totals.totalProject)}
          hint="Pagos asociados a proyectos"
          icon={<FolderKanban className="size-5" />}
          tone="success"
        />
        <Metric
          label="Obras"
          value={formatCurrency(report.totals.totalWork)}
          hint="Pagos asociados a obras"
          icon={<Wrench className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Pagos por cuenta" description="Distribución entre Caja y Cuenta de Rosa.">
          {report.totals.totalCash + report.totals.totalAccount > 0 ? (
            <DonutChart
              slices={[
                { label: "Caja", value: report.totals.totalCash, color: CHART_COLORS.brand },
                { label: "Cuenta de Rosa", value: report.totals.totalAccount, color: CHART_COLORS.c3 },
              ]}
              valueFormat="currency"
              centerLabel="Pagado"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin pagos en el mes.</p>
          )}
        </ChartCard>
        <ChartCard title="Proyecto vs Obra" description="Pagos asociados a proyectos y obras.">
          {report.totals.totalProject + report.totals.totalWork > 0 ? (
            <DonutChart
              slices={[
                { label: "Proyectos", value: report.totals.totalProject, color: CHART_COLORS.brand },
                { label: "Obras", value: report.totals.totalWork, color: CHART_COLORS.c4 },
              ]}
              valueFormat="currency"
              centerLabel="Pagado"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin pagos asociados.</p>
          )}
        </ChartCard>
      </div>

      <MonthToolbar report={report} onCreateWeek={openCreateWeek} />

      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Registros de semanas</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona una semana para revisar actividades, pagos por cuenta y registrar nuevos pagos.
          </p>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="px-5">Semana</TableHead>
              <TableHead>Pago previsto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Empleados</TableHead>
              <TableHead className="text-right">Total pagado</TableHead>
              <TableHead className="px-5 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.weeks.map((week) => (
                <TableRow key={week.id}>
                  <TableCell className="px-5">
                    <div className="font-medium">
                      {formatDate(week.week_start_date)} - {formatDate(week.week_end_date)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {week.employees.length} empleado{week.employees.length === 1 ? "" : "s"} activo{week.employees.length === 1 ? "" : "s"}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(week.payment_date)}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusTone(week.status))}>
                      {SALARY_WEEK_STATUS_LABELS[week.status]}
                    </span>
                  </TableCell>
                  <TableCell>{week.employees.length}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(week.totals.total)}
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptsWeek(week)}
                      >
                        <ReceiptText className="size-4" />
                        Comprobantes de pago
                      </Button>
                      <Link
                        href={`/finance/salario/${week.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Abrir
                        <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {report.weeks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No hay semanas registradas para este mes.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <WeekSheet open={weekSheetOpen} onOpenChange={setWeekSheetOpen} week={editingWeek} />
      <SalaryReceiptsSheet
        key={receiptsWeek?.id ?? "salary-receipts"}
        open={!!receiptsWeek}
        onOpenChange={(open) => !open && setReceiptsWeek(null)}
        week={receiptsWeek}
      />
    </div>
  );
}
