"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WORK_STATUS_LABELS, WORK_STATUSES } from "@/lib/constants";
import type { Client, WorkWithFinance } from "@/lib/types";
import { createWorkAction, updateWorkAction } from "@/app/(dashboard)/obras/actions";

type ClientMode = "existing" | "new";

export function WorkForm({
  clients,
  work,
}: {
  clients: Client[];
  work?: WorkWithFinance;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(work?.name ?? "");
  const [status, setStatus] = useState(work?.status ?? "active");
  const [description, setDescription] = useState(work?.description ?? "");
  const [clientMode, setClientMode] = useState<ClientMode>(
    work || clients.length > 0 ? "existing" : "new",
  );
  const [clientId, setClientId] = useState(work?.client_id ?? "");
  const [clientName, setClientName] = useState("");

  const clientItems = clients.map((client) => ({ label: client.name, value: client.id }));
  const statusItems = WORK_STATUSES.map((item) => ({
    label: WORK_STATUS_LABELS[item],
    value: item,
  }));

  function submit() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        id: work?.id,
        name,
        clientId: clientMode === "existing" ? clientId : "",
        clientName: clientMode === "new" ? clientName : "",
        status,
        description,
      };
      const result = work
        ? await updateWorkAction(payload)
        : await createWorkAction(payload);
      if (result.ok) {
        toast.success(work ? "Obra actualizada" : "Obra creada", {
          description: name,
        });
        router.push(`/obras/${result.data.workId}`);
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
      <Card className="gap-0 p-0">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Datos de la obra</h2>
          <p className="text-sm text-muted-foreground">
            Información general y cliente asociado.
          </p>
        </div>
        <div className="grid gap-4 p-5">
          <div className="grid gap-2">
            <Label htmlFor="work-name">Nombre de la obra</Label>
            <Input
              id="work-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Casa de Alejandro López Atilano"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-2">
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
                onValueChange={(value) => setClientId(value ?? "")}
                items={clientItems}
              >
                <SelectTrigger className="w-full" aria-invalid={!!errors.clientId}>
                  <SelectValue placeholder="Selecciona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Nombre del nuevo cliente"
                aria-invalid={!!errors.clientId || !!errors.clientName}
              />
            )}
            {(errors.clientId || errors.clientName) && (
              <p className="text-xs text-destructive">
                {errors.clientId ?? errors.clientName}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="work-status">Estado</Label>
            <Select value={status} onValueChange={(value) => setStatus((value ?? "active") as typeof status)} items={statusItems}>
              <SelectTrigger id="work-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {WORK_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="work-description">Descripción</Label>
            <Textarea
              id="work-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Notas opcionales de la obra"
            />
          </div>
        </div>
      </Card>

      <Card className="gap-0 p-0">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Confirmación</h2>
          <p className="text-sm text-muted-foreground">
            Guarda la obra para empezar a registrar movimientos.
          </p>
        </div>
        <div className="grid gap-3 p-5">
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {work ? "Guardar cambios" : "Crear obra"}
          </Button>
          <Button variant="outline" onClick={() => router.push(work ? `/obras/${work.id}` : "/obras")}>
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  );
}
