/** export SVG si tiparire (PDF din dialogul browserului) pentru desenele generate */
export function downloadSVG(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const vb = svg.viewBox.baseVal;
  if (vb) {
    clone.setAttribute("width", String(vb.width));
    clone.setAttribute("height", String(vb.height));
  }
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Tipareste doar elementul dat (A3 peisaj). Din dialogul de tiparire se poate
 * salva direct ca PDF.
 */
export function printElement(el: Element | null, landscapeA3 = true) {
  if (!el) return;
  const style = document.createElement("style");
  style.textContent = `@page { size: ${landscapeA3 ? "A3 landscape" : "A4 portrait"}; margin: 8mm; }
@media print {
  body * { visibility: hidden !important; }
  .print-target, .print-target * { visibility: visible !important; }
  .print-target { position: fixed; left: 0; top: 0; width: 100%; }
}`;
  document.head.appendChild(style);
  el.classList.add("print-target");
  const done = () => {
    el.classList.remove("print-target");
    style.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/**
 * Tiparire pe mai multe pagini: continutul este copiat intr-un iframe ascuns,
 * impreuna cu stilurile aplicatiei, si tiparit acolo (paginare reala, pagini
 * A4 portret si pagini peisaj pentru scheme: clasa .page-landscape).
 */
export function printPages(el: Element | null, title = "WATTNET") {
  if (!el) return;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("\n");
  doc.open();
  doc.write(`<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><title>${title}</title>${styles}
<style>
  @page { size: A4 portrait; margin: 12mm 12mm 14mm 12mm; }
  @page landscape { size: A4 landscape; margin: 8mm; }
  html, body { background: #fff !important; }
  .page { break-after: page; }
  .page:last-child { break-after: auto; }
  .page-landscape { page: landscape; }
  .avoid-break { break-inside: avoid; }
  .dossier { background: #fff !important; padding: 0 !important; }
  .dossier .page { width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 0 22px 0 !important; box-shadow: none !important; }
  .dossier .page > .absolute.bottom-3 { left: 0 !important; right: 0 !important; bottom: 0 !important; }
</style></head><body>${el.outerHTML}</body></html>`);
  doc.close();
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1500);
  };
  // asteptam incarcarea stilurilor
  if (doc.readyState === "complete") setTimeout(go, 300);
  else iframe.onload = () => setTimeout(go, 300);
}
