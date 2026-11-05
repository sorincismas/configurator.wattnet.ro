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
