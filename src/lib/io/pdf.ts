/**
 * Export direct in PDF (fara fereastra de tiparire): documentul se deseneaza la
 * rezolutie mare, se aseaza pe pagini A4 si se descarca.
 *  - elementele cu clasa .page devin pagini separate (.page-landscape = A4 peisaj);
 *  - continutul mai lung de o pagina se imparte intre randuri de tabel / blocuri,
 *    nu prin mijlocul unui rand;
 *  - desenele SVG (scheme, tablou) se pun intregi pe o pagina A4 peisaj.
 */

const MARGIN = 10; // mm
const FOOTER = 6; // mm rezervati pentru numarul paginii
/** limita de pixeli a unui canvas pe telefoane (Safari) */
const MAX_AREA = 15_000_000;

export interface PdfOptions {
  /** toate paginile in peisaj (altfel doar cele cu .page-landscape) */
  landscape?: boolean;
  /** incadreaza fiecare pagina intreaga pe o singura foaie (pentru desene) */
  fit?: boolean;
}

type Sheet = { canvas: HTMLCanvasElement; landscape: boolean; fit: boolean; breaks: number[] };

const safeName = (s: string) => (s.replace(/[^\w.\- ]+/g, "_").trim() || "document") + (s.toLowerCase().endsWith(".pdf") ? "" : ".pdf");

/** pozitiile (px in canvas) unde pagina se poate rupe fara sa taie un rand */
function breakPoints(el: HTMLElement, scale: number): number[] {
  const top = el.getBoundingClientRect().top;
  const out = new Set<number>();
  el.querySelectorAll<HTMLElement>("tr, .avoid-break, p, h1, h2, h3, li, table, svg").forEach((n) => {
    // randurile din interiorul unui bloc .avoid-break nu sunt puncte de rupere
    const keep = n.closest(".avoid-break");
    if (keep && keep !== n) return;
    out.add(Math.round((n.getBoundingClientRect().bottom - top) * scale));
  });
  return [...out].sort((a, b) => a - b);
}

async function rasterizeSvg(svg: SVGSVGElement, targetWidth = 4200): Promise<HTMLCanvasElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  const h = vb && vb.height ? vb.height : svg.getBoundingClientRect().height;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("desenul nu a putut fi incarcat"));
      img.src = url;
    });
    const k = Math.min(targetWidth / w, Math.sqrt(MAX_AREA / (w * h)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function build(sheets: Sheet[], filename: string) {
  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | null = null;
  const addPage = (landscape: boolean) => {
    const o = landscape ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ orientation: o, unit: "mm", format: "a4", compress: true });
    else pdf.addPage("a4", o);
    return pdf;
  };
  for (const s of sheets) {
    const W = s.landscape ? 297 : 210;
    const H = s.landscape ? 210 : 297;
    const cw = W - 2 * MARGIN;
    const ch = H - 2 * MARGIN - FOOTER;
    const { canvas } = s;
    if (s.fit || canvas.height / canvas.width <= ch / cw) {
      const k = Math.min(cw / canvas.width, ch / canvas.height);
      const w = canvas.width * k;
      addPage(s.landscape).addImage(canvas, "PNG", MARGIN + (cw - w) / 2, MARGIN, w, canvas.height * k, undefined, "FAST");
      continue;
    }
    // continut mai lung de o pagina: felii rupte intre randuri
    const pagePx = Math.floor((ch / cw) * canvas.width);
    let y = 0;
    while (y < canvas.height - 2) {
      let end = Math.min(canvas.height, y + pagePx);
      if (end < canvas.height) {
        const candidate = s.breaks.filter((b) => b > y + pagePx * 0.35 && b <= end).pop();
        if (candidate) end = candidate;
      }
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = end - y;
      slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      addPage(s.landscape).addImage(slice, "PNG", MARGIN, MARGIN, cw, (slice.height / canvas.width) * cw, undefined, "FAST");
      y = end;
    }
  }
  if (!pdf) return;
  const doc = pdf as InstanceType<typeof jsPDF>;
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const { width, height } = doc.internal.pageSize;
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`pagina ${i} / ${n}`, width - MARGIN, height - 6, { align: "right" });
  }
  doc.save(safeName(filename));
}

/** exporta un document HTML (oferta, proforma, dosar) in PDF A4 */
export async function exportPdf(el: HTMLElement | null, filename: string, opts: PdfOptions = {}) {
  if (!el) return;
  const html2canvas = (await import("html2canvas-pro")).default;
  if (document.fonts?.ready) await document.fonts.ready;
  const nodes = el.querySelectorAll<HTMLElement>(".page").length ? [...el.querySelectorAll<HTMLElement>(".page")] : [el];
  const sheets: Sheet[] = [];
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    const scale = Math.max(1.5, Math.min(3, Math.sqrt(MAX_AREA / Math.max(1, r.width * r.height))));
    const canvas = await html2canvas(node, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const landscape = !!opts.landscape || node.classList.contains("page-landscape");
    sheets.push({ canvas, landscape, fit: !!opts.fit || node.classList.contains("page-landscape"), breaks: breakPoints(node, scale) });
  }
  await build(sheets, filename);
}

/** exporta un desen SVG (schema monofilara, vedere tablou) pe o pagina A4 peisaj */
export async function exportSvgPdf(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  await build([{ canvas: await rasterizeSvg(svg), landscape: true, fit: true, breaks: [] }], filename);
}
