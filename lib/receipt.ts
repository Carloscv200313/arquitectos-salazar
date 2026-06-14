// Datos y utilidades del recibo de dinero (boleta de abono).

export const RECEIPT_BUSINESS = {
  address: "Hidalgo 108 int 2, Degollado, Jal.",
  phone: "Cel. 348 148 4098",
  email: "salazararq0.0@gmail.com",
} as const;

export type ReceiptKind = "proyecto" | "obra";

// abono = "RECIBO DE DINERO" (cobro a cliente)
// pago  = "COMPROBANTE DE PAGO" (pago a empleado)
export type ReceiptDocType = "abono" | "pago";

export interface ReceiptData {
  docType: ReceiptDocType;
  kind: ReceiptKind;
  code: string | null;
  amount: number;
  concept: string;
  date: string; // ISO yyyy-mm-dd del pago
  clientName: string; // cliente (abono) o empleado (pago)
  subjectName: string; // nombre del proyecto u obra
}

// Serie única de los comprobantes de pago a empleados.
export const SALARY_RECEIPT_PREFIX = "CMP";

export const RECEIPT_PREFIX: Record<ReceiptKind, string> = {
  proyecto: "PRY",
  obra: "OBR",
};

export const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = {
  proyecto: "Abono de proyecto",
  obra: "Abono de obra",
};

/** Build a receipt code from a kind + sequential number: PRY-000123 / OBR-000123. */
export function formatReceiptCode(kind: ReceiptKind, seq: number): string {
  return `${RECEIPT_PREFIX[kind]}-${String(seq).padStart(6, "0")}`;
}

/** Extract the numeric sequence from a receipt code, or 0 if it doesn't match. */
export function parseReceiptSeq(kind: ReceiptKind, code: string | null | undefined): number {
  return parseSeqWithPrefix(RECEIPT_PREFIX[kind], code);
}

/** Build a code from an arbitrary prefix + sequential number: CMP-000123. */
export function formatCodeWithPrefix(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

/** Extract the numeric sequence from a "PREFIX-000123" code, or 0 if no match. */
export function parseSeqWithPrefix(prefix: string, code: string | null | undefined): number {
  if (!code) return 0;
  const m = code.match(new RegExp(`^${prefix}-(\\d+)$`));
  return m ? Number(m[1]) : 0;
}

// ── Número a letras (español, pesos M.N.) ──────────────────────────────────

const UNIDADES = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
];

const DECENAS = [
  "",
  "",
  "VEINTI",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function decenasALetras(n: number): string {
  if (n <= 20) return UNIDADES[n];
  if (n < 30) return n === 20 ? "VEINTE" : `VEINTI${UNIDADES[n - 20]}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
}

function centenasALetras(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const pre = CENTENAS[c];
  const post = resto > 0 ? decenasALetras(resto) : "";
  return [pre, post].filter(Boolean).join(" ");
}

function seccionALetras(n: number): string {
  // n: 0..999
  return centenasALetras(n);
}

function enteroALetras(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const cientos = n % 1000;

  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLÓN" : `${seccionALetras(millones)} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? "MIL" : `${seccionALetras(miles)} MIL`);
  }
  if (cientos > 0) {
    partes.push(seccionALetras(cientos));
  }
  return partes.join(" ").trim();
}

/** "1000" → "MIL PESOS"; "1234.50" → "MIL DOSCIENTOS TREINTA Y CUATRO PESOS CON 50/100" */
export function montoEnPalabras(amount: number): string {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const entero = Math.floor(safe);
  const centavos = Math.round((safe - entero) * 100);
  const letras = enteroALetras(entero);
  const pesos = entero === 1 ? "PESO" : "PESOS";
  if (centavos > 0) return `${letras} ${pesos} CON ${String(centavos).padStart(2, "0")}/100`;
  return `${letras} ${pesos}`;
}

/** "1234.50" → "MIL DOSCIENTOS TREINTA Y CUATRO PESOS 50/100 M.N." */
export function numeroALetras(amount: number): string {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const entero = Math.floor(safe);
  const centavos = Math.round((safe - entero) * 100);
  const letras = enteroALetras(entero);
  const pesos = entero === 1 ? "PESO" : "PESOS";
  return `${letras} ${pesos} ${String(centavos).padStart(2, "0")}/100 M.N.`;
}
