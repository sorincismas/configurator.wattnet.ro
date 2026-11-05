"use client";
/**
 * Document pentru beneficiar, format A4: oferta / deviz sau factura proforma,
 * in varianta simplificata sau detaliata. Generat din acelasi calcul ca devizul.
 */
import { forwardRef } from "react";
import type { DocRow, QuoteDocument } from "@/lib/engine/quote";
import type { Project } from "@/lib/model/types";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Logo } from "../shell/Logo";

const roDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

function RowsTable({ title, rows, cur, detail }: { title: string; rows: DocRow[]; cur: string; detail: boolean }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="mb-4">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide">{title}</p>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y border-[#14181f] bg-[#f3f2ee] text-left">
            <th className="w-10 px-1.5 py-1">Nr.</th>
            <th className="px-1.5 py-1">Denumire</th>
            {detail && <th className="w-10 px-1.5 py-1">UM</th>}
            {detail && <th className="w-14 px-1.5 py-1 text-right">Cant.</th>}
            {detail && <th className="w-20 px-1.5 py-1 text-right">Pret unitar</th>}
            <th className="w-24 px-1.5 py-1 text-right">Valoare</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#dcd9d1] align-top">
              <td className="px-1.5 py-1 text-[#4a5260]">{detail ? i + 1 : r.code}</td>
              <td className="px-1.5 py-1">{r.name}</td>
              {detail && <td className="px-1.5 py-1">{r.unit}</td>}
              {detail && <td className="px-1.5 py-1 text-right tabular-nums">{r.quantity === null ? "" : fmtNum(r.quantity, 2)}</td>}
              {detail && <td className="px-1.5 py-1 text-right tabular-nums">{r.unitPrice === null ? "" : fmtMoney(r.unitPrice, "")}</td>}
              <td className="px-1.5 py-1 text-right tabular-nums">{fmtMoney(r.value, cur)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td />
            <td className="px-1.5 py-1 text-right" colSpan={detail ? 4 : 1}>Total {title.toLowerCase()}</td>
            <td className="px-1.5 py-1 text-right tabular-nums">{fmtMoney(total, cur)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const QuoteDoc = forwardRef<HTMLDivElement, { p: Project; doc: QuoteDocument }>(function QuoteDoc({ p, doc }, ref) {
  const f = p.library.firm;
  const c = p.info.client;
  const cur = f.currency;
  const t = doc.totals;
  const detail = doc.detail === "detaliat";
  const proforma = doc.kind === "proforma";

  return (
    <div ref={ref} className="quote-doc mx-auto bg-white text-[#14181f]" style={{ width: 794, minHeight: 1123, padding: "40px 44px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* antet */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-[#14181f] pb-3">
        <div className="text-[11px] leading-[1.45]">
          <div className="mb-2"><Logo firm={f} size={34} /></div>
          <p className="text-[13px] font-bold">{f.legalName || f.name}</p>
          {f.cui && <p>CUI: {f.cui}{f.regCom && ` · Reg. Com.: ${f.regCom}`}</p>}
          {f.address && <p>{f.address}</p>}
          <p>{[f.phone, f.email, f.website].filter(Boolean).join(" · ")}</p>
          {f.anreAuthorization && <p>Electrician autorizat ANRE {f.anreGrade} nr. {f.anreAuthorization}</p>}
          {proforma && f.iban && <p>IBAN: {f.iban}{f.bank && ` · ${f.bank}`}</p>}
        </div>
        <div className="text-right text-[11px] leading-[1.5]">
          <p className="text-[18px] font-bold tracking-wide">{doc.title}</p>
          <p>Nr. <b>{doc.number}</b></p>
          <p>Data: <b>{roDate(doc.date)}</b></p>
          <p>{proforma ? "Scadenta" : "Valabila pana la"}: <b>{roDate(doc.untilDate)}</b></p>
          {!proforma && detail && <p className="text-[#4a5260]">Varianta detaliata</p>}
          {proforma && <p className="text-[#4a5260]">{detail ? "Varianta detaliata" : "Varianta simplificata"}</p>}
        </div>
      </div>

      {/* parti */}
      <div className="mt-3 grid grid-cols-2 gap-6 text-[11px] leading-[1.45]">
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase text-[#4a5260]">{proforma ? "Cumparator" : "Beneficiar"}</p>
          <p className="text-[12px] font-bold">{c.name || "—"}</p>
          {c.address && <p>{c.address}</p>}
          <p>{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase text-[#4a5260]">Lucrare</p>
          <p className="text-[12px] font-bold">{p.info.name}</p>
          {p.info.location && <p>{p.info.location}</p>}
          <p>
            Proiect {p.info.code} · {doc.scopeLabel}
            {p.info.phases.length > 0 && ` · ${p.info.phases.map((x) => (x === "rosu" ? "faza la rosu" : "faza la gata")).join(", ")}`}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <RowsTable title="Manopera" rows={doc.laborRows} cur={cur} detail={detail} />
        {doc.extras.length > 0 && <RowsTable title="Costuri suplimentare" rows={doc.extras} cur={cur} detail={false} />}
        {doc.materialRows.length > 0 && <RowsTable title="Materiale" rows={doc.materialRows} cur={cur} detail={detail} />}
      </div>

      {/* totaluri */}
      <div className="ml-auto mt-2 w-[330px] text-[11.5px]">
        <Line label={doc.extras.length ? "Manopera si costuri suplimentare" : "Manopera"} value={fmtMoney(t.laborSubtotal, cur)} />
        {t.laborDiscount > 0 && <Line label={`Discount manopera (${p.quote.laborDiscountPct}%)`} value={"-" + fmtMoney(t.laborDiscount, cur)} />}
        {t.materialsSubtotal !== null && <Line label="Materiale" value={fmtMoney(t.materialsSubtotal, cur)} />}
        {t.materialsDiscount ? <Line label={`Discount materiale (${p.quote.materialsDiscountPct}%)`} value={"-" + fmtMoney(t.materialsDiscount, cur)} /> : null}
        <Line label="Total fara TVA" value={fmtMoney(t.net, cur)} strong />
        {t.vatPayer ? <Line label={`TVA ${t.vatRatePct}%`} value={fmtMoney(t.vat, cur)} /> : <Line label={f.vatNote || "Neplatitor de TVA"} value="" muted />}
        <div className="mt-1 flex justify-between border-y-2 border-[#14181f] py-1.5 text-[13px] font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{fmtMoney(t.gross, cur)}</span>
        </div>
        {proforma && doc.advancePct < 100 && (
          <div className="mt-1 flex justify-between bg-[#fff3c4] px-1.5 py-1.5 text-[13px] font-bold">
            <span>De plata: avans {doc.advancePct}%</span>
            <span className="tabular-nums">{fmtMoney(doc.payable, cur)}</span>
          </div>
        )}
      </div>

      {/* conditii */}
      <div className="mt-5 space-y-2 text-[10.5px] leading-[1.45] text-[#2b313b]">
        {proforma ? (
          <>
            <p><b>Plata:</b> prin transfer bancar{f.iban ? ` in contul ${f.iban}` : ""}, pana la {roDate(doc.untilDate)}. Va rugam mentionati numarul proformei ({doc.number}) la plata.</p>
            {p.quote.proforma?.notes && <p>{p.quote.proforma.notes}</p>}
            <p className="text-[#4a5260]">Factura proforma nu este document fiscal. Factura fiscala se emite conform legislatiei, la incasare / livrare.</p>
          </>
        ) : (
          <>
            {p.info.assumptionsText && <p><b>Ipoteze:</b> {p.info.assumptionsText}</p>}
            {p.info.exclusionsText && <p><b>Nu sunt incluse:</b> {p.info.exclusionsText}</p>}
            {f.offerTerms && <p><b>Conditii:</b> {f.offerTerms}</p>}
            <p><b>Valabilitate:</b> {p.quote.validityDays} zile de la data ofertei. Durata estimata de executie: {fmtNum(doc.hours, 1)} ore de manopera.</p>
          </>
        )}
        {p.quote.clientNotes && <p><b>Observatii:</b> {p.quote.clientNotes}</p>}
      </div>

      {/* semnaturi */}
      <div className="mt-10 grid grid-cols-2 gap-10 text-[11px]">
        <div>
          <p className="font-bold">{proforma ? "Furnizor" : "Ofertant"}</p>
          <p>{f.legalName || f.name}</p>
          <p>{f.designer}</p>
          <div className="mt-8 border-t border-[#8a919c] pt-1 text-[10px] text-[#4a5260]">semnatura si stampila</div>
        </div>
        {!proforma && (
          <div>
            <p className="font-bold">Beneficiar - accept oferta</p>
            <p>{c.name || " "}</p>
            <p>&nbsp;</p>
            <div className="mt-8 border-t border-[#8a919c] pt-1 text-[10px] text-[#4a5260]">nume, semnatura, data</div>
          </div>
        )}
      </div>
    </div>
  );
});

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={"flex justify-between py-0.5 " + (strong ? "font-semibold" : "") + (muted ? " text-[#4a5260] italic" : "")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
