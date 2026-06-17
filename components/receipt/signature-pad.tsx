"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface SignaturePadHandle {
  toDataURL: () => string;
  clear: () => void;
  isEmpty: () => boolean;
}

/**
 * Pizarra para dibujar una firma con mouse o dedo. Expone toDataURL/clear/isEmpty
 * por ref. Trazo negro sobre fondo blanco; exporta PNG.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const dirty = useRef(false);
    const [empty, setEmpty] = useState(true);

    // Ajusta la resolución del canvas a su tamaño en pantalla (nítido en pantallas retina).
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "#1a1a1a";
        }
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    function pos(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = pos(e);
    }

    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !last.current) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      if (!dirty.current) {
        dirty.current = true;
        setEmpty(false);
      }
    }

    function end() {
      drawing.current = false;
      last.current = null;
    }

    function clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty.current = false;
      setEmpty(true);
    }

    useImperativeHandle(ref, () => ({
      clear,
      isEmpty: () => !dirty.current,
      toDataURL: () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        // Aplana sobre fondo blanco para que el PNG no salga transparente.
        const out = document.createElement("canvas");
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext("2d");
        if (!ctx) return canvas.toDataURL("image/png");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        return out.toDataURL("image/png");
      },
    }));

    return (
      <div className={className}>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-44 w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-neutral-300 bg-white"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{empty ? "Dibuja la firma con el mouse o el dedo." : "Firma capturada."}</span>
          <button type="button" onClick={clear} className="font-medium text-foreground hover:underline">
            Limpiar
          </button>
        </div>
      </div>
    );
  },
);
