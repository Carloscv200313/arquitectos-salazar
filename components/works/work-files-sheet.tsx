"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Eye,
  File,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { WORK_FILE_MAX_BYTES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { WorkFile } from "@/lib/types";
import {
  deleteWorkFileAction,
  getWorkFileViewUrlAction,
  uploadWorkFileAction,
} from "@/app/(dashboard)/obras/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(file: WorkFile): string {
  if (file.mime_type?.startsWith("image/")) return "Imagen";
  if (file.mime_type === "application/pdf") return "PDF";
  if (file.mime_type?.includes("sheet") || file.mime_type?.includes("excel")) return "Hoja";
  if (file.mime_type?.includes("word") || file.mime_type?.includes("document")) return "Documento";
  return "Archivo";
}

function FileIcon({ file }: { file: WorkFile }) {
  if (file.mime_type?.startsWith("image/")) {
    return <FileImage className="size-4 text-brand-foreground" />;
  }
  if (file.mime_type === "application/pdf") {
    return <FileText className="size-4 text-destructive" />;
  }
  return <File className="size-4 text-muted-foreground" />;
}

export function WorkFilesSheet({
  open,
  onOpenChange,
  workId,
  workName,
  clientName,
  initialFiles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workId: string;
  workName: string;
  clientName: string;
  initialFiles: WorkFile[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<WorkFile[]>(initialFiles);
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isOpening, startOpenTransition] = useTransition();

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size_bytes, 0),
    [files],
  );

  function triggerUpload() {
    inputRef.current?.click();
  }

  function uploadSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    const selected = Array.from(fileList);

    startUploadTransition(async () => {
      const uploaded: WorkFile[] = [];
      for (const file of selected) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await uploadWorkFileAction(workId, formData);
        if (!result.ok) {
          toast.error(result.error, { description: file.name });
          continue;
        }
        uploaded.push(result.data.file);
      }

      if (uploaded.length) {
        setFiles((current) => [...uploaded, ...current]);
        toast.success(
          uploaded.length === 1 ? "Archivo subido" : "Archivos subidos",
          { description: uploaded.map((file) => file.file_name).join(", ") },
        );
      }

      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function openFile(fileId: string) {
    startOpenTransition(async () => {
      const result = await getWorkFileViewUrlAction(fileId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  function removeFile(file: WorkFile) {
    startDeleteTransition(async () => {
      const result = await deleteWorkFileAction(workId, file.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFiles((current) => current.filter((item) => item.id !== file.id));
      toast.success("Archivo eliminado", { description: file.file_name });
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(860px,84vw)] data-[side=right]:max-w-[min(860px,84vw)] data-[side=right]:sm:max-w-[min(860px,84vw)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Archivos de la obra</SheetTitle>
          <SheetDescription>
            {workName} · {clientName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">Documentos y archivos adjuntos</div>
              <div className="text-xs text-muted-foreground">
                {files.length} archivo{files.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
              </div>
              <div className="text-xs text-muted-foreground">
                Límite por archivo: {formatBytes(WORK_FILE_MAX_BYTES)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(isUploading || isDeleting || isOpening) && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => uploadSelected(event.target.files)}
              />
              <Button onClick={triggerUpload} disabled={isUploading}>
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Subir archivos
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/70">
            <div className="grid grid-cols-[minmax(0,2.3fr)_120px_110px_160px_110px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div>Archivo</div>
              <div>Tipo</div>
              <div>Tamaño</div>
              <div>Fecha</div>
              <div className="text-right">Acciones</div>
            </div>

            {files.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                <Paperclip className="size-5" />
                <div>No hay archivos cargados para esta obra.</div>
              </div>
            ) : (
              <div className="divide-y">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-[minmax(0,2.3fr)_120px_110px_160px_110px] items-center gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded-md bg-muted p-1.5">
                          <FileIcon file={file} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{file.file_name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {file.mime_type || "application/octet-stream"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-muted-foreground">{fileTypeLabel(file)}</div>
                    <div className="tabular-nums text-muted-foreground">{formatBytes(file.size_bytes)}</div>
                    <div className="text-muted-foreground">{formatDateTime(file.created_at)}</div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => openFile(file.id)}
                        title="Ver archivo"
                      >
                        <Eye className="size-4" />
                        <span className="sr-only">Ver archivo</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeFile(file)}
                        title="Eliminar archivo"
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Eliminar archivo</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
