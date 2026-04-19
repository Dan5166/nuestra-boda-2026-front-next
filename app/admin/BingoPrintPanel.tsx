"use client";

import { useRef, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PrintCard {
  id: number;
  cells: Array<{ text: string; isFree: boolean }>;
}

interface FreqEntry {
  phrase: string;
  count: number;
}

function calcFrequency(cards: PrintCard[], allPhrases: string[]): FreqEntry[] {
  // Initialize every phrase at 0 so las que nunca aparecen también se muestran
  const map = new Map<string, number>(allPhrases.map((p) => [p, 0]));
  for (const card of cards) {
    for (const cell of card.cells) {
      if (!cell.isFree) {
        map.set(cell.text, (map.get(cell.text) ?? 0) + 1);
      }
    }
  }
  return [...map.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
}

// ── Canvas constants ───────────────────────────────────────────────────────────

// Square canvas: 900×900. Grid fills the space between header and footer,
// centered horizontally so cells are perfectly square.
const CANVAS_SIZE = 900;
const CANVAS_TOP_PAD = 28;       // vertical offset for header text
const CANVAS_HEADER_H = 148;     // y where the grid starts
const CANVAS_FOOTER_H = 48;
const CANVAS_GRID_SIDE =
  CANVAS_SIZE - CANVAS_HEADER_H - CANVAS_FOOTER_H - CANVAS_TOP_PAD; // 676
const CANVAS_H_PAD = (CANVAS_SIZE - CANVAS_GRID_SIDE) / 2;           // 112

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  fontSize: number
): void {
  ctx.font = `${fontSize}px Georgia, serif`;
  const lineHeight = fontSize * 1.35;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const MAX_LINES = 5;
  const display = lines.slice(0, MAX_LINES);
  if (lines.length > MAX_LINES) {
    display[MAX_LINES - 1] =
      display[MAX_LINES - 1].replace(/\s?\S+$/, "") + "…";
  }

  const totalH = display.length * lineHeight;
  const startY = cy - totalH / 2 + lineHeight * 0.72;
  display.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}

function drawCardOnCanvas(
  canvas: HTMLCanvasElement,
  card: PrintCard,
  gridSize: number,
  freeImg: HTMLImageElement | null = null
): void {
  const ctx = canvas.getContext("2d")!;

  // Square canvas, square grid, square cells
  const S = CANVAS_SIZE;                             // 900
  const cellSize = CANVAS_GRID_SIDE / gridSize;      // e.g. 135.2 for 5×5
  const hPad = CANVAS_H_PAD;                        // 112  — centers grid horizontally
  const gridTop = CANVAS_HEADER_H;                  // 148  — grid y origin

  canvas.width = S;
  canvas.height = S;

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#fdfaf6";
  ctx.fillRect(0, 0, S, S);

  // ── Outer gradient border (square) ───────────────────────────────────────
  const borderGrad = ctx.createLinearGradient(0, 0, S, 0);
  borderGrad.addColorStop(0, "#bf953f");
  borderGrad.addColorStop(0.4, "#fcf6ba");
  borderGrad.addColorStop(0.6, "#d4af37");
  borderGrad.addColorStop(1, "#b38728");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, S - 14, S - 14);

  // ── Inner thin border ─────────────────────────────────────────────────────
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(22, 22, S - 44, S - 44);

  // ── Header ────────────────────────────────────────────────────────────────
  ctx.fillStyle = "#5c4a2e";
  ctx.font = "bold 38px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("Dominic & Danyael", S / 2, CANVAS_TOP_PAD + 50);

  ctx.fillStyle = "#8a6d3b";
  ctx.font = "22px Georgia, serif";
  ctx.fillText("Bingo de la Boda  ·  19 Abril 2026", S / 2, CANVAS_TOP_PAD + 84);

  // Decorative line under header
  const lineGrad = ctx.createLinearGradient(hPad, 0, S - hPad, 0);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.2, "#d4af37");
  lineGrad.addColorStop(0.8, "#d4af37");
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hPad, CANVAS_TOP_PAD + 100);
  ctx.lineTo(S - hPad, CANVAS_TOP_PAD + 100);
  ctx.stroke();

  // Card number (top right)
  ctx.fillStyle = "#d4af37";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`N° ${card.id}`, S - hPad - 4, CANVAS_TOP_PAD + 22);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const fontSize =
    gridSize <= 3 ? 34 : gridSize === 4 ? 28 : gridSize === 5 ? 22 : 18;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const idx = row * gridSize + col;
      const cell = card.cells[idx];
      const x = hPad + col * cellSize;
      const y = gridTop + row * cellSize;

      // Cell fill
      if (!cell.isFree) {
        ctx.fillStyle = (row + col) % 2 === 0 ? "#ffffff" : "#fffdf7";
        ctx.fillRect(x, y, cellSize, cellSize);
      }

      // Cell border
      if (!(cell.isFree && freeImg)) {
        ctx.strokeStyle = "#d4af37";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }

      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;

      if (cell.isFree) {
        if (freeImg) {
          const scale = Math.max(cellSize / freeImg.width, cellSize / freeImg.height);
          const dw = freeImg.width * scale;
          const dh = freeImg.height * scale;
          const dx = x + (cellSize - dw) / 2;
          const dy = y + (cellSize - dh) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cellSize, cellSize);
          ctx.clip();
          ctx.drawImage(freeImg, dx, dy, dw, dh);
          const overlayH = cellSize * 0.28;
          const overlayGrd = ctx.createLinearGradient(
            x, y + cellSize - overlayH,
            x, y + cellSize
          );
          overlayGrd.addColorStop(0, "rgba(0,0,0,0)");
          overlayGrd.addColorStop(1, "rgba(0,0,0,0.55)");
          ctx.fillStyle = overlayGrd;
          ctx.fillRect(x, y + cellSize - overlayH, cellSize, overlayH);
          ctx.restore();
          ctx.strokeStyle = "#d4af37";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x, y, cellSize, cellSize);
        } else {
          const grd = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
          grd.addColorStop(0, "#bf953f");
          grd.addColorStop(1, "#d4af37");
          ctx.fillStyle = grd;
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.fillStyle = "#ffffff";
          ctx.font = `${Math.round(cellSize * 0.32)}px serif`;
          ctx.textAlign = "center";
          ctx.fillText("★", cx, cy - cellSize * 0.05);
          ctx.font = `bold ${Math.round(fontSize * 0.95)}px Georgia, serif`;
          ctx.fillText("LIBRE", cx, cy + cellSize * 0.28);
        }
      } else {
        ctx.fillStyle = "#5c4a2e";
        ctx.textAlign = "center";
        wrapText(ctx, cell.text, cx, cy, cellSize - 14, fontSize);
      }
    }
  }

  // Outer grid border
  ctx.strokeStyle = "#bf953f";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(hPad, gridTop, CANVAS_GRID_SIDE, CANVAS_GRID_SIDE);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = gridTop + CANVAS_GRID_SIDE + 12;
  ctx.fillStyle = "#c8a95e";
  ctx.font = "italic 14px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("nuestraboda2026.cl  ·  Con amor 💛", S / 2, footerY + 20);
}

// ── Phrase bingo card generator ────────────────────────────────────────────────
//
// Algoritmo "highest-remaining-first":
//   1. Calcula cuántas veces debe aparecer cada frase para cubrir todos los
//      slots (numCards × K). Las frases se reparten lo más equitativamente
//      posible; si hay sobrante, algunas llevan 1 aparición extra.
//   2. En cada cartón elige siempre la frase con más ocurrencias pendientes
//      que aún no esté en ese cartón → garantiza cobertura total y sin
//      duplicados dentro del mismo cartón.
//
// Retorna también `canCoverAll`: false cuando hay menos slots que frases
// (se usa para mostrar advertencia en la UI).

interface BuildResult {
  cards: PrintCard[];
  canCoverAll: boolean;
}

function buildCards(
  phraseList: string[],
  gridSize: number,
  numCards: number,
  freeCenter: boolean
): BuildResult {
  const totalCells = gridSize * gridSize;
  const center = Math.floor(totalCells / 2);
  const K = totalCells - (freeCenter ? 1 : 0); // frases por cartón
  const N = phraseList.length;
  const totalSlots = numCards * K;
  const canCoverAll = totalSlots >= N;

  // ── Asignar cuántas veces debe aparecer cada frase ──────────────────────
  // Orden aleatorio para que las frases "extra" no sean siempre las mismas
  const shuffledPhrases = [...phraseList].sort(() => Math.random() - 0.5);
  const baseCount = canCoverAll ? Math.floor(totalSlots / N) : 0;
  const extras = canCoverAll ? totalSlots % N : 0;

  // remaining[phrase] = cuántas apariciones le faltan
  const remaining = new Map<string, number>();
  shuffledPhrases.forEach((p, i) => {
    remaining.set(p, baseCount + (i < extras ? 1 : 0));
  });

  // ── Generar cartones ─────────────────────────────────────────────────────
  const cardPhrases: string[][] = [];

  for (let c = 0; c < numCards; c++) {
    const inCard = new Set<string>();
    const picked: string[] = [];

    // Ordenar por pendientes desc (+ ruido aleatorio para desempate)
    const sorted = [...remaining.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || Math.random() - 0.5);

    for (const [phrase] of sorted) {
      if (picked.length >= K) break;
      if (!inCard.has(phrase)) {
        picked.push(phrase);
        inCard.add(phrase);
        remaining.set(phrase, remaining.get(phrase)! - 1);
      }
    }

    // Si no alcanzó (no canCoverAll), completar al azar sin repetir
    if (picked.length < K) {
      const fallback = shuffledPhrases
        .filter((p) => !inCard.has(p))
        .sort(() => Math.random() - 0.5);
      for (const p of fallback) {
        if (picked.length >= K) break;
        picked.push(p);
        inCard.add(p);
      }
    }

    // Mezclar posiciones para que el patrón visual no sea predecible
    picked.sort(() => Math.random() - 0.5);
    cardPhrases.push(picked);
  }

  // ── Armar objetos PrintCard ──────────────────────────────────────────────
  const cards: PrintCard[] = cardPhrases.map((phrases, idx) => {
    const cells: PrintCard["cells"] = [];
    let phraseIdx = 0;
    for (let i = 0; i < totalCells; i++) {
      if (freeCenter && i === center) {
        cells.push({ text: "LIBRE", isFree: true });
      } else {
        cells.push({ text: phrases[phraseIdx++] ?? "?", isFree: false });
      }
    }
    return { id: idx + 1, cells };
  });

  return { cards, canCoverAll };
}

// ── Component ──────────────────────────────────────────────────────────────────

const EXAMPLE_PHRASES = `El primer baile de los novios
Lanzamiento del ramo
El padre llora de emoción
Alguien llega tarde a la ceremonia
Los novios se ríen en el altar
Un niño corre por el salón
Discurso que hace llorar a todos
Alguien se pierde al ir al baño
La abuela baila la cueca
Brindis con champagne
El fotógrafo en todas partes
Alguien pide matrimonio en la fiesta
El DJ pone una canción inesperada
Los novios se roban un beso
Confeti en el aire
Alguien se cae bailando
El pastel de bodas
Fuegos artificiales o bengalas
El vals de los novios
Mesa de dulces
La liga de la novia
Lluvia de arroz o pétalos
Un abrazo grupal enorme
Todos cantan una canción juntos
El ramo cae en manos inesperadas`.trim();

export default function BingoPrintPanel() {
  const [phrasesText, setPhrasesText] = useState(EXAMPLE_PHRASES);
  const [gridSize, setGridSize] = useState(5);
  const [numCards, setNumCards] = useState(10);
  const [freeCenter, setFreeCenter] = useState(true);
  const [freeImage, setFreeImage] = useState<string | null>(null); // data URL
  const [cards, setCards] = useState<PrintCard[]>([]);
  const [frequency, setFrequency] = useState<FreqEntry[]>([]);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => setFreeImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  const phraseList = phrasesText
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const totalCells = gridSize * gridSize;
  const phrasesNeeded = totalCells - (freeCenter ? 1 : 0);

  function handleGenerate() {
    setError("");
    if (phraseList.length < phrasesNeeded) {
      setError(
        `Necesitás al menos ${phrasesNeeded} frases para un cartón ${gridSize}×${gridSize}. Tenés ${phraseList.length}.`
      );
      return;
    }
    const { cards: newCards, canCoverAll } = buildCards(
      phraseList,
      gridSize,
      numCards,
      freeCenter
    );
    if (!canCoverAll) {
      setError(
        `Con ${numCards} cartón${numCards !== 1 ? "es" : ""} de ${gridSize}×${gridSize} hay ${numCards * phrasesNeeded} slots en total, pero tenés ${phraseList.length} frases. ` +
          `Algunas frases no aparecerán. Aumentá la cantidad de cartones o reducí las frases.`
      );
    }
    setCards(newCards);
    setFrequency(calcFrequency(newCards, phraseList));
  }

  const downloadPNG = useCallback(
    async (card: PrintCard) => {
      setDownloadingId(card.id);
      const imgEl = freeImage ? await loadImage(freeImage) : null;
      const canvas = document.createElement("canvas");
      drawCardOnCanvas(canvas, card, gridSize, imgEl);
      const link = document.createElement("a");
      link.download = `bingo-carton-${String(card.id).padStart(2, "0")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setDownloadingId(null);
    },
    [gridSize, freeImage]
  );

  async function handleDownloadAll() {
    const imgEl = freeImage ? await loadImage(freeImage) : null;
    cards.forEach((card, i) => {
      setTimeout(() => {
        const canvas = document.createElement("canvas");
        drawCardOnCanvas(canvas, card, gridSize, imgEl);
        const link = document.createElement("a");
        link.download = `bingo-carton-${String(card.id).padStart(2, "0")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }, i * 120);
    });
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="bg-white rounded-xl shadow p-5 space-y-5">
        <h3 className="font-serif text-lg text-[#5c4a2e]">
          Bingo de frases para imprimir
        </h3>

        {/* Phrases textarea */}
        <div>
          <label className="block text-sm font-medium text-[#5c4a2e] mb-1">
            Frases{" "}
            <span className="font-normal text-gray-400">
              (una por línea · {phraseList.length} cargadas)
            </span>
          </label>
          <textarea
            className="w-full h-52 border border-gray-300 rounded-lg px-3 py-2 text-sm font-sans text-[#5c4a2e] resize-y focus:outline-none focus:border-[#bf953f] leading-relaxed"
            value={phrasesText}
            onChange={(e) => setPhrasesText(e.target.value)}
            placeholder="Escribe una frase por línea…"
            spellCheck={false}
          />
          {phraseList.length < phrasesNeeded && phraseList.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Faltan {phrasesNeeded - phraseList.length} frases más para generar
              cartones {gridSize}×{gridSize}.
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">Grilla</span>
            <select
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
            >
              {[3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}×{n} ({n * n} casillas)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">Cantidad</span>
            <input
              type="number"
              min={1}
              max={200}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={numCards}
              onChange={(e) =>
                setNumCards(Math.max(1, Math.min(200, Number(e.target.value))))
              }
            />
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <label className="flex items-center gap-2 cursor-pointer pt-5">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#d4af37]"
                checked={freeCenter}
                onChange={(e) => {
                  setFreeCenter(e.target.checked);
                  if (!e.target.checked) setFreeImage(null);
                }}
              />
              <span className="text-gray-500">Casilla libre al centro</span>
            </label>
          </div>
        </div>

        {/* Foto para la casilla libre */}
        {freeCenter && (
          <div>
            <p className="text-sm font-medium text-[#5c4a2e] mb-2">
              Foto para la casilla libre{" "}
              <span className="font-normal text-gray-400">(opcional)</span>
            </p>
            <div className="flex items-center gap-3">
              {freeImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={freeImage}
                    alt="casilla libre"
                    className="w-16 h-16 rounded-lg object-cover border-2 border-[#d4af37]"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      className="text-xs text-[#bf953f] hover:underline text-left"
                    >
                      Cambiar foto
                    </button>
                    <button
                      onClick={() => setFreeImage(null)}
                      className="text-xs text-gray-400 hover:text-red-400 text-left"
                    >
                      Quitar foto
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => imgInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#d4af37] rounded-lg text-sm text-[#8a6d3b] hover:bg-[#fdf5e8] transition"
                >
                  <span className="text-lg">📷</span>
                  Subir foto
                </button>
              )}
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={phraseList.length < phrasesNeeded}
          className="px-6 py-2.5 bg-[#bf953f] text-white font-medium rounded-lg hover:bg-[#aa771c] transition disabled:opacity-40"
        >
          Generar {numCards} cartón{numCards !== 1 ? "es" : ""}
        </button>
      </div>

      {/* Generated cards */}
      {cards.length > 0 && (
        <div className="space-y-4">
          {/* Export actions */}
          <div className="bg-white rounded-xl shadow px-5 py-4 flex flex-wrap items-center gap-3 justify-between">
            <p className="text-sm text-[#5c4a2e] font-medium">
              {cards.length} cartón{cards.length !== 1 ? "es" : ""} generado
              {cards.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={handleDownloadAll}
              className="px-4 py-2 bg-[#bf953f] text-white text-sm rounded-lg hover:bg-[#aa771c] transition"
            >
              ↓ Descargar todos (PNG)
            </button>
          </div>

          {/* Frequency summary */}
          <FrequencySummary entries={frequency} totalCards={cards.length} />

          {/* Cards preview grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((card) => (
              <CardPreview
                key={card.id}
                card={card}
                gridSize={gridSize}
                freeImage={freeImage}
                downloading={downloadingId === card.id}
                onDownload={() => downloadPNG(card)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Frequency summary ──────────────────────────────────────────────────────────

function FrequencySummary({
  entries,
  totalCards,
}: {
  entries: FreqEntry[];
  totalCards: number;
}) {
  const [open, setOpen] = useState(false);

  const maxCount = entries[0]?.count ?? 0;
  const unused = entries.filter((e) => e.count === 0).length;
  const used = entries.length - unused;

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#fdfaf6] transition text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-serif text-[#5c4a2e]">
            Frecuencia de frases
          </span>
          <span className="text-xs bg-[#f5ede0] text-[#8a6d3b] px-2.5 py-0.5 rounded-full">
            {used} usadas{unused > 0 ? ` · ${unused} sin usar` : ""}
          </span>
        </div>
        <span className="text-[#d4af37] text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-[#e8d9c0] divide-y divide-[#f5ede0]">
          {entries.map(({ phrase, count }) => {
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const absPct = (count / totalCards) * 100;
            // Color: green if high, amber if medium, gray if zero
            const barColor =
              count === 0
                ? "bg-gray-200"
                : count === maxCount
                ? "bg-[#d4af37]"
                : count >= totalCards * 0.6
                ? "bg-[#c8a42e]"
                : "bg-[#e8d9c0]";

            return (
              <div
                key={phrase}
                className="flex items-center gap-3 px-5 py-2.5"
              >
                {/* Bar */}
                <div className="w-28 shrink-0 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Phrase */}
                <span
                  className={`flex-1 text-sm ${
                    count === 0 ? "text-gray-400 line-through" : "text-[#5c4a2e]"
                  }`}
                >
                  {phrase}
                </span>

                {/* Count badge */}
                <span
                  className={`shrink-0 text-xs font-mono font-semibold min-w-[3.5rem] text-right ${
                    count === 0
                      ? "text-gray-300"
                      : count === maxCount
                      ? "text-[#bf953f]"
                      : "text-[#8a6d3b]"
                  }`}
                >
                  {count === 0 ? "—" : `${count}/${totalCards}`}
                  {count > 0 && (
                    <span className="text-[10px] text-gray-400 ml-1">
                      ({Math.round(absPct)}%)
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Card preview component ─────────────────────────────────────────────────────

function CardPreview({
  card,
  gridSize,
  freeImage,
  downloading,
  onDownload,
}: {
  card: PrintCard;
  gridSize: number;
  freeImage: string | null;
  downloading: boolean;
  onDownload: () => void;
}) {
  const fontSize =
    gridSize <= 3 ? "text-sm" : gridSize === 4 ? "text-xs" : "text-[10px]";

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden border-2 border-[#d4af37]">
      {/* Mini header */}
      <div className="bg-[#fdfaf6] border-b border-[#e8d9c0] px-3 py-2 flex items-center justify-between">
        <div>
          <p className="font-serif text-sm text-[#5c4a2e] leading-tight">
            Dominic &amp; Danyael
          </p>
          <p className="text-[10px] text-[#8a6d3b]">Bingo · 19 Abril 2026</p>
        </div>
        <span className="text-xs font-mono text-[#d4af37] font-bold">
          N° {card.id}
        </span>
      </div>

      {/* Grid */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      >
        {card.cells.map((cell, i) => (
          <div
            key={i}
            className={`border border-[#d4af37]/60 flex items-center justify-center text-center aspect-square overflow-hidden ${
              cell.isFree
                ? freeImage
                  ? "p-0"
                  : "p-1 bg-gradient-to-br from-[#bf953f] to-[#d4af37]"
                : (Math.floor(i / gridSize) + (i % gridSize)) % 2 === 0
                ? "p-1 bg-white"
                : "p-1 bg-[#fffdf7]"
            }`}
          >
            {cell.isFree ? (
              freeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={freeImage}
                  alt="libre"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-xs font-bold leading-tight">
                  ★<br />LIBRE
                </span>
              )
            ) : (
              <span
                className={`${fontSize} text-[#5c4a2e] leading-tight line-clamp-4`}
              >
                {cell.text}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Download button */}
      <div className="px-3 py-2 border-t border-[#e8d9c0] flex justify-end">
        <button
          onClick={onDownload}
          disabled={downloading}
          className="text-xs text-[#bf953f] hover:text-[#aa771c] transition disabled:opacity-50 flex items-center gap-1"
        >
          {downloading ? (
            <>
              <span className="w-3 h-3 border border-[#bf953f] border-t-transparent rounded-full animate-spin" />
              Generando…
            </>
          ) : (
            "↓ Descargar PNG"
          )}
        </button>
      </div>
    </div>
  );
}
