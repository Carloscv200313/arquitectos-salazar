"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TABLE_TEXT_WRAP_LIMIT = 30
const DEFAULT_TABLE_PAGE_SIZE = 10

function wrapTextByWords(text: string) {
  const words = text.trim().replace(/\s+/g, " ").split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    if (!current) {
      current = word
      continue
    }

    const next = `${current} ${word}`
    if (next.length > TABLE_TEXT_WRAP_LIMIT) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.join("\n")
}

function formatTableText(value: string | number) {
  if (typeof value === "number") return value
  const text = String(value)
  if (text.length <= TABLE_TEXT_WRAP_LIMIT) return value

  const wrapped = wrapTextByWords(text)
  return (
    <span
      title={text}
      className="inline-block max-w-[36ch] whitespace-pre-line break-words align-top leading-snug"
    >
      {wrapped}
    </span>
  )
}

function formatTableContent(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return formatTableText(child)
    }
    if (!React.isValidElement(child)) return child

    const element = child as React.ReactElement<{
      children?: React.ReactNode
      "data-no-table-truncate"?: boolean
    }>
    if (element.props["data-no-table-truncate"]) return element
    if (element.props.children === undefined) return element

    return React.cloneElement(element, undefined, formatTableContent(element.props.children))
  })
}

type TablePaginationState = {
  totalItems: number
  startIndex: number
  endIndex: number
  page: number
  pageCount: number
  setPage: (page: number) => void
  itemLabel: string
}

const TablePaginationContext = React.createContext<
  ((state: TablePaginationState | null) => void) | null
>(null)

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const [pagination, setPagination] = React.useState<TablePaginationState | null>(null)

  return (
    <TablePaginationContext.Provider value={setPagination}>
      <div
        data-slot="table-container"
        className="relative w-full overflow-x-auto"
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
      {pagination && <TablePagination {...pagination} className="border-t" />}
    </TablePaginationContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function isPinnedRow(node: React.ReactNode) {
  return React.isValidElement<{ pinned?: boolean }>(node) && node.props.pinned === true
}

/**
 * Regla de diseño: toda tabla con más de `pageSize` (10) filas se pagina.
 * Las filas marcadas con `<TableRow pinned>` (totales, resúmenes) se muestran
 * siempre al final de cada página y no cuentan como registros.
 * La paginación se dibuja debajo de la tabla cuando el body está dentro de `<Table>`;
 * usa `paginate={false}` sólo si la tabla ya se pagina manualmente.
 */
function TableBody({
  className,
  children,
  paginate = true,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  itemLabel = "registros",
  ...props
}: React.ComponentProps<"tbody"> & {
  paginate?: boolean
  pageSize?: number
  itemLabel?: string
}) {
  const registerPagination = React.useContext(TablePaginationContext)
  const allRows = React.Children.toArray(children)
  const pinnedRows = allRows.filter(isPinnedRow)
  const rows = allRows.filter((row) => !isPinnedRow(row))
  const enabled = paginate && registerPagination !== null
  const { rows: visibleRows, shouldPaginate, totalItems, startIndex, endIndex, page, pageCount, setPage } =
    useTablePagination(rows, enabled ? pageSize : Number.POSITIVE_INFINITY)

  React.useEffect(() => {
    if (!registerPagination) return
    registerPagination(
      shouldPaginate
        ? { totalItems, startIndex, endIndex, page, pageCount, setPage, itemLabel }
        : null,
    )
  }, [registerPagination, shouldPaginate, totalItems, startIndex, endIndex, page, pageCount, setPage, itemLabel])

  React.useEffect(() => {
    if (!registerPagination) return
    return () => registerPagination(null)
  }, [registerPagination])

  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    >
      {visibleRows}
      {pinnedRows}
    </tbody>
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  pinned,
  ...props
}: React.ComponentProps<"tr"> & {
  /** Fila fija (totales/resúmenes): no se pagina y aparece en todas las páginas. */
  pinned?: boolean
}) {
  return (
    <tr
      data-slot="table-row"
      data-pinned={pinned || undefined}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, children, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    >
      {formatTableContent(children)}
    </td>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function TablePagination({
  totalItems,
  startIndex,
  endIndex,
  page,
  pageCount,
  setPage,
  itemLabel = "registros",
  className,
}: {
  totalItems: number
  startIndex: number
  endIndex: number
  page: number
  pageCount: number
  setPage: (page: number) => void
  itemLabel?: string
  className?: string
}) {
  if (totalItems <= 0 || pageCount <= 1) return null

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span>
        Mostrando {startIndex + 1}-{endIndex} de {totalItems} {itemLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs">
          Página {page + 1} de {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(page - 1, 0))}
          disabled={page === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(page + 1, pageCount - 1))}
          disabled={page >= pageCount - 1}
          aria-label="Página siguiente"
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function useTablePagination<T>(items: readonly T[], pageSize = DEFAULT_TABLE_PAGE_SIZE) {
  const [page, setPage] = React.useState(0)
  const [previousLength, setPreviousLength] = React.useState(items.length)
  if (previousLength !== items.length) {
    setPreviousLength(items.length)
    setPage(0)
  }
  const shouldPaginate = items.length > pageSize
  const pageCount = Math.max(Math.ceil(items.length / pageSize), 1)
  const safePage = Math.min(page, pageCount - 1)
  const startIndex = shouldPaginate ? safePage * pageSize : 0
  const endIndex = shouldPaginate ? Math.min(startIndex + pageSize, items.length) : items.length
  const rows = shouldPaginate ? items.slice(startIndex, endIndex) : items

  return {
    rows,
    shouldPaginate,
    totalItems: items.length,
    startIndex,
    endIndex,
    page: safePage,
    pageCount,
    setPage,
  }
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TablePagination,
  useTablePagination,
}
