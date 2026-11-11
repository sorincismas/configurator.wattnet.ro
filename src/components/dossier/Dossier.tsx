"use client";
/**
 * Dosarul tehnic si comercial (cap. 11): 14 capitole generate din model.
 * Capitolele fara continut se marcheaza explicit „neaplicabil”; nu se
 * inventeaza valori lipsa. Schemele monofilare se tiparesc pe pagini A4 peisaj.
 */
import { forwardRef, type ReactNode } from "react";
import { DinView } from "../panel/DinView";
import { SingleLine } from "../panel/SingleLine";
import { Logo } from "../shell/Logo";
import { allCircuitLoads } from "@/lib/engine/circuits";
import { allChecks, checkStats } from "@/lib/engine/checks";
import { cableLength, conduitLength, roomArea, roomPerimeter, routeLength } from "@/lib/engine/measure";
import { layoutPanel, deviceOf } from "@/lib/engine/panels";
import { availablePower, appliedPower, installedPower } from "@/lib/engine/power";
import { buildDocument } from "@/lib/engine/quote";
import { autoRegister, REGISTER_CATEGORY_LABEL } from "@/lib/engine/register";
import { computeSchedule } from "@/lib/engine/schedule";
import { analyzeCircuit } from "@/lib/engine/sizing";
import { computeSummary } from "@/lib/engine/summary";
import { DOC_KIND_LABEL, revLabel } from "@/lib/engine/versions";
import { fmtDate, fmtKW, fmtMoney, fmtNum, NA } from "@/lib/format";
import type { Project, Tracked } from "@/lib/model/types";

export const CHAPTERS = [
  { id: 1, title: "Coperta" },
  { id: 2, title: "Informatii proiect" },
  { id: 3, title: "Inventar instalatie" },
  { id: 4, title: "Centralizator cantitati" },
  { id: 5, title: "Lista traseelor" },
  { id: 6, title: "Lista circuitelor" },
  { id: 7, title: "Echiparea tablourilor" },
  { id: 8, title: "Vedere fizica tablouri" },
  { id: 9, title: "Scheme monofilare" },
  { id: 10, title: "Verificari tehnice" },
  { id: 11, title: "Plan de executie" },
  { id: 12, title: "Deviz" },
  { id: 13, title: "Anexe grafice" },
  { id: 14, title: "Observatii si control" },
] as const;

const T = "w-full border-collapse text-[10px]";
const TH = "border border-[#8a919c] bg-[#eceae4] px-1.5 py-1 text-left font-bold";
const TD = "border border-[#b9b5ab] px-1.5 py-0.5 align-top";
const TDN = TD + " text-right tabular-nums";

const prov = (t: Tracked<number> | undefined | null, unit = "") =>
  !t || t.value === null ? NA : `${fmtNum(t.value, 2)}${unit}${t.provenance === "masurat" ? " (M)" : t.provenance === "estimat" ? " (E)" : t.provenance === "beneficiar" ? " (B)" : ""}`;

function Page({ children, landscape, footer }: { children: ReactNode; landscape?: boolean; footer: string }) {
  return (
    <section className={"page relative bg-white text-[#14181f] " + (landscape ? "page-landscape" : "")} style={{ width: landscape ? 1030 : 760, minHeight: landscape ? 700 : 1060, padding: landscape ? "16px" : "28px 30px 40px", margin: "0 auto 16px", fontFamily: "Arial, Helvetica, sans-serif", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
      {children}
      <div className="absolute bottom-3 left-8 right-8 flex justify-between border-t border-[#cdc8bc] pt-1 text-[8.5px] text-[#6f7682]">
        <span>{footer}</span>
      </div>
    </section>
  );
}

function H({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="mb-3 border-b-2 border-[#14181f] pb-1">
      <h2 className="text-[15px] font-bold">
        {n}. {title}
      </h2>
      {sub && <p className="text-[9.5px] text-[#4a5260]">{sub}</p>}
    </div>
  );
}

const NotApplicable = ({ why }: { why: string }) => <p className="rounded border border-dashed border-[#b9b5ab] px-3 py-4 text-center text-[11px] text-[#4a5260]">Neaplicabil - {why}</p>;

export const Dossier = forwardRef<HTMLDivElement, { p: Project; chapters: number[]; versionLabel: string; issuedAt?: string }>(function Dossier({ p, chapters, versionLabel, issuedAt }, ref) {
  const f = p.library.firm;
  const s = computeSummary(p);
  const loads = allCircuitLoads(p);
  const checks = allChecks(p);
  const stats = checkStats(checks);
  const reg = autoRegister(p);
  const sched = computeSchedule(p, s.labor);
  const doc = buildDocument(p, "oferta", "detaliat");
  const footer = `${f.legalName || f.name} · ${p.info.code} ${p.info.name} · ${versionLabel}${issuedAt ? " emis " + fmtDate(issuedAt) : ""}`;
  const has = (n: number) => chapters.includes(n);
  const cur = f.currency;
  const levelName = (id: string) => p.levels.find((l) => l.id === id)?.name ?? "";
  const roomName = (id: string | null) => p.rooms.find((r) => r.id === id)?.name ?? "—";

  return (
    <div ref={ref} className="dossier bg-[#e9e7e1] py-4">
      {/* 1. COPERTA */}
      {has(1) && (
        <Page footer={footer}>
          <div className="flex h-[960px] flex-col">
            <div className="flex items-start justify-between">
              <Logo firm={f} size={44} />
              <div className="text-right text-[10px] leading-[1.5] text-[#3c4350]">
                <p className="font-bold">{f.legalName}</p>
                <p>{[f.phone, f.email].filter(Boolean).join(" · ")}</p>
                <p>{f.website}</p>
              </div>
            </div>
            <div className="mt-[220px] text-center">
              <p className="text-[12px] uppercase tracking-[0.3em] text-[#4a5260]">Dosar tehnic si comercial</p>
              <h1 className="mt-3 text-[28px] font-bold leading-tight">{p.info.name}</h1>
              <p className="mt-2 text-[13px]">{p.info.location || "—"}</p>
              <p className="mt-6 text-[12px]">Instalatii electrice · {p.info.phases.includes("rosu") && p.info.phases.includes("gata") ? "faza la rosu + faza la gata" : p.info.phases.includes("gata") ? "faza la gata" : "faza la rosu"}</p>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-4 text-[11px]">
              <table className={T}>
                <tbody>
                  <tr><td className={TH}>Beneficiar</td><td className={TD}>{p.info.client.name || "—"}</td></tr>
                  <tr><td className={TH}>Numar proiect</td><td className={TD}>{p.info.code}</td></tr>
                  <tr><td className={TH}>Versiune</td><td className={TD}>{versionLabel}</td></tr>
                  <tr><td className={TH}>Data</td><td className={TD}>{fmtDate(issuedAt ?? new Date().toISOString())}</td></tr>
                </tbody>
              </table>
              <table className={T}>
                <tbody>
                  <tr><td className={TH}>Executant</td><td className={TD}>{f.legalName}</td></tr>
                  <tr><td className={TH}>Electrician</td><td className={TD}>{f.designer}</td></tr>
                  <tr><td className={TH}>Autorizatie ANRE</td><td className={TD}>{f.anreGrade} nr. {f.anreAuthorization}</td></tr>
                  <tr><td className={TH}>Tip document</td><td className={TD}>Dosar tehnic · cap. {chapters.join(", ")}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </Page>
      )}

      {/* 2. INFORMATII PROIECT */}
      {has(2) && (
        <Page footer={footer}>
          <H n={2} title="Informatii proiect" />
          <table className={T}>
            <tbody>
              {[
                ["Beneficiar", [p.info.client.name, p.info.client.address, p.info.client.phone, p.info.client.email].filter(Boolean).join(" · ") || "—"],
                ["Executant", `${f.legalName} · ${f.designer} · ANRE ${f.anreGrade} nr. ${f.anreAuthorization}`],
                ["Lucrare / amplasament", `${p.info.name} · ${p.info.location || "—"}`],
                ["Tip cladire", p.info.kind === "altul" ? p.info.customKind || "altul" : p.info.kind],
                ["Obiectul lucrarii", p.info.partial ? `Lucrare partiala: ${p.info.partialScope || "—"}` : "Instalatie electrica interioara"],
                ["Faze", p.info.phases.map((x) => (x === "rosu" ? "la rosu" : "la gata")).join(", ")],
                ["Alimentare", `${p.supply.system === "mono" ? "monofazata" : "trifazata"} ${p.supply.voltageV} V · protectie generala ${prov(p.supply.mainBreakerA, " A")} · putere aprobata ${prov(p.supply.approvedPowerKW, " kW")}`],
                ["Sistem legare la pamant", p.supply.earthing === "necunoscut" ? "de identificat" : p.supply.earthing],
                ["Putere disponibila", s.power.available.effectiveKW === null ? "date insuficiente" : `${fmtNum(s.power.available.effectiveKW)} kW (${s.power.available.basis})`],
                ["Putere instalata", `${fmtKW(installedPower(p).value)}${s.power.installed.unknownCount ? ` (${s.power.installed.unknownCount} consumatori fara putere)` : ""}`],
                ["Putere aplicata", appliedPower(p).value === null ? "date insuficiente" : `${fmtKW(appliedPower(p).value)}${appliedPower(p).insufficient ? " (date incomplete)" : ""}`],
                ["Simultaneitate globala", prov(p.globalSimultaneity)],
                ["cos φ de calcul", fmtNum(p.supply.cosPhi)],
              ].map(([k, v]) => (
                <tr key={k}><td className={TH + " w-48"}>{k}</td><td className={TD}>{v}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[10.5px]"><b>Ipoteze:</b> {p.info.assumptionsText || "—"}</p>
          <p className="mt-1 text-[10.5px]"><b>Excluderi:</b> {p.info.exclusionsText || "—"}</p>
          <p className="mt-3 text-[9px] text-[#4a5260]">(M) masurat · (E) estimat · (B) furnizat de beneficiar. Disponibilitate putere: {availablePower(p).basis}.</p>
        </Page>
      )}

      {/* 3. INVENTAR */}
      {has(3) && (
        <Page footer={footer}>
          <H n={3} title="Inventar instalatie" sub="Cladiri, niveluri, incaperi, dimensiuni si caracteristici" />
          {p.rooms.length === 0 ? (
            <NotApplicable why="nu sunt definite incaperi" />
          ) : (
            <table className={T}>
              <thead>
                <tr><th className={TH}>Cod</th><th className={TH}>Incapere</th><th className={TH}>Nivel</th><th className={TH}>L x l x H (m)</th><th className={TH}>S (m²)</th><th className={TH}>P (m)</th><th className={TH}>Perete</th><th className={TH}>DA</th><th className={TH}>DD</th><th className={TH}>Aparate</th></tr>
              </thead>
              <tbody>
                {p.rooms.map((r) => (
                  <tr key={r.id}>
                    <td className={TD}>{r.code}</td>
                    <td className={TD}>{r.name}</td>
                    <td className={TD}>{levelName(r.levelId)}</td>
                    <td className={TD}>{[r.lengthM, r.widthM, r.heightM].map((t) => prov(t)).join(" x ")}</td>
                    <td className={TDN}>{fmtNum(roomArea(r).value)}</td>
                    <td className={TDN}>{fmtNum(roomPerimeter(r).value)}</td>
                    <td className={TD}>{p.library.wallTypes.find((w) => w.id === r.wallTypeId)?.name ?? "—"}</td>
                    <td className={TDN}>{p.boxes.filter((b) => b.roomId === r.id && b.kind === "DA").length}</td>
                    <td className={TDN}>{p.boxes.filter((b) => b.roomId === r.id && b.kind === "DD").length}</td>
                    <td className={TDN}>{p.devices.filter((d) => d.roomId === r.id && !d.placeholder).length}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={TD} colSpan={4}>Total {p.buildings.length} cladiri · {p.levels.length} niveluri · {p.rooms.length} incaperi</td>
                  <td className={TDN}>{fmtNum(s.area.value)}</td>
                  <td className={TD} colSpan={2} />
                  <td className={TDN}>{s.counts.boxesDA}</td>
                  <td className={TDN}>{s.counts.boxesDD}</td>
                  <td className={TDN}>{p.devices.filter((d) => !d.placeholder).length}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Page>
      )}

      {/* 4. CENTRALIZATOR */}
      {has(4) && (
        <Page footer={footer}>
          <H n={4} title="Centralizator cantitati" />
          <table className={T + " max-w-[480px]"}>
            <tbody>
              {[
                ["Doze aparat (DA)", s.counts.boxesDA, "buc"],
                ["Doze derivatie (DD)", s.counts.boxesDD, "buc"],
                ["Module in doze aparat", p.boxes.filter((b) => b.kind === "DA").reduce((a, b) => a + b.modules, 0), "mod."],
                ["Prize", s.counts.sockets, "buc"],
                ["Intrerupatoare / comutatoare", s.counts.switches, "buc"],
                ["Puncte de iluminat", s.counts.lighting, "buc"],
                ["Consumatori dedicati, comenzi, alte aparate", s.counts.otherDevices, "buc"],
                ["Puncte curenti slabi", s.counts.lowVoltage, "buc"],
                ["Circuite", s.counts.circuits, "buc"],
                ["Tablouri", s.counts.panels, "buc"],
                ["Aparate modulare in tablouri", p.panels.reduce((a, t) => a + t.items.filter((i) => !i.isSpare).length, 0), "buc"],
                ["Trasee", s.counts.routes, "buc"],
                ["Traseu fizic / sant", `${fmtNum(s.lengths.route.value, 1)} / ${fmtNum(s.lengths.chase.value, 1)}`, "m"],
                ["Tub copex", fmtNum(s.lengths.conduit.value, 1), "m"],
                ["Cablu (pe circuite)", fmtNum(s.lengths.cable.value, 1), "m"],
              ].map(([k, v, u]) => (
                <tr key={String(k)}><td className={TD}>{k}</td><td className={TDN + " w-24 font-bold"}>{v}</td><td className={TD + " w-12"}>{u}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[9.5px] text-[#4a5260]">Lungimi: {s.lengths.cable.certainty === "masurat" ? "masurate" : s.lengths.cable.certainty === "partial" ? "partial masurate" : "estimate"}{s.lengths.cable.missing ? `, ${s.lengths.cable.missing} valori lipsa` : ""}.</p>
        </Page>
      )}

      {/* 5. TRASEE */}
      {has(5) && (
        <Page footer={footer}>
          <H n={5} title="Lista traseelor" sub="Traseu fizic (sant numarat o singura data), tuburi si cabluri asociate; (M) masurat, (E) estimat" />
          {p.routes.length === 0 ? (
            <NotApplicable why="traseele nu sunt modelate; lungimile circuitelor sunt estimate pe circuit" />
          ) : (
            p.routes.map((r) => (
              <div key={r.id} className="avoid-break mb-3">
                <p className="text-[11px] font-bold">{r.code} {r.name} · {r.surface}{r.requiresChase ? " · cu sant" : ""} · {fmtNum(routeLength(r).value, 1)} m ({routeLength(r).certainty})</p>
                <table className={T}>
                  <thead><tr><th className={TH}>De la</th><th className={TH}>Pana la</th><th className={TH}>Lungime</th><th className={TH}>Tuburi si circuite</th></tr></thead>
                  <tbody>
                    {r.segments.map((sg, i) => (
                      <tr key={sg.id}>
                        <td className={TD}>{sg.from.label}</td>
                        <td className={TD}>{sg.to.label}</td>
                        <td className={TDN}>{prov(sg.lengthM, " m")}</td>
                        {i === 0 && (
                          <td className={TD} rowSpan={r.segments.length}>
                            {r.conduits.map((cd) => `${cd.code} ${p.library.conduitTypes.find((t) => t.id === cd.conduitTypeId)?.name ?? ""} ${fmtNum(conduitLength(r, cd).value, 1)} m: ${cd.circuitIds.map((id) => p.circuits.find((c) => c.id === id)?.code).join(", ") || "-"}`).join(" | ")}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
          {p.cables.length > 0 && (
            <>
              <p className="mt-3 text-[11px] font-bold">Cabluri</p>
              <table className={T}>
                <thead><tr><th className={TH}>Cod</th><th className={TH}>Circuit</th><th className={TH}>Tip</th><th className={TH}>Trasee</th><th className={TH}>Lungime</th></tr></thead>
                <tbody>
                  {p.cables.map((cb) => {
                    const c = p.circuits.find((x) => x.id === cb.circuitId);
                    const q = cableLength(p, cb);
                    return (
                      <tr key={cb.id}>
                        <td className={TD}>{cb.code}</td>
                        <td className={TD}>{c?.code} {c?.name}</td>
                        <td className={TD}>{p.library.cableTypes.find((t) => t.id === (cb.cableTypeId ?? c?.cableTypeId))?.name ?? "—"}</td>
                        <td className={TD}>{cb.routeIds.map((id) => p.routes.find((r) => r.id === id)?.code).join(", ")}</td>
                        <td className={TDN}>{fmtNum(q.value, 1)} m {q.certainty === "masurat" ? "(M)" : "(E)"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Page>
      )}

      {/* 6. CIRCUITE */}
      {has(6) && (
        <Page footer={footer}>
          <H n={6} title="Lista circuitelor" sub="Fisa fiecarui circuit: destinatie, tablou, faza, puncte, putere, cablu, protectie, calcule" />
          {loads.length === 0 ? (
            <NotApplicable why="nu sunt definite circuite" />
          ) : (
            <table className={T}>
              <thead>
                <tr>
                  <th className={TH}>Cod</th><th className={TH}>Destinatie</th><th className={TH}>Tablou</th><th className={TH}>Faza</th><th className={TH}>Puncte</th><th className={TH}>P inst. W</th><th className={TH}>ks</th><th className={TH}>P apl. W</th><th className={TH}>Ic A</th><th className={TH}>Cablu</th><th className={TH}>Pozare</th><th className={TH}>L m</th><th className={TH}>Protectie</th><th className={TH}>I&apos;z A</th><th className={TH}>ΔU %</th>
                </tr>
              </thead>
              <tbody>
                {loads.map((l) => {
                  const c = l.circuit;
                  const a = analyzeCircuit(p, c);
                  const pd = p.library.protectionDevices.find((d) => d.id === c.protection.protectionDeviceId);
                  return (
                    <tr key={c.id} className="avoid-break">
                      <td className={TD + " font-bold"}>{c.code}</td>
                      <td className={TD}>{c.name}{c.existing ? " (existent)" : ""}</td>
                      <td className={TD}>{p.panels.find((t) => t.id === c.panelId)?.code ?? "—"}</td>
                      <td className={TD}>{p.supply.system === "mono" ? "L1" : c.phase ?? "—"}</td>
                      <td className={TDN}>{l.devices.length || c.declaredPoints || "—"}</td>
                      <td className={TDN}>{l.installed.value === null ? NA : fmtNum(l.installed.value, 0)}</td>
                      <td className={TDN}>{c.simultaneity.value ?? NA}</td>
                      <td className={TDN}>{l.appliedW === null ? NA : fmtNum(l.appliedW, 0)}</td>
                      <td className={TDN}>{l.designCurrentA === null ? NA : fmtNum(l.designCurrentA, 1)}</td>
                      <td className={TD}>{a.cable?.name ?? "de stabilit"}</td>
                      <td className={TD}>{a.iz.method ?? "—"}</td>
                      <td className={TDN}>{l.length.value === null ? NA : fmtNum(l.length.value, 1) + (l.length.certainty === "masurat" ? "" : " E")}</td>
                      <td className={TD}>{pd ? `${pd.curve ?? ""}${pd.ratingA} ${pd.poles}` : "de stabilit"}</td>
                      <td className={TDN}>{a.iz.izCorrected === null ? NA : fmtNum(a.iz.izCorrected, 1)}</td>
                      <td className={TDN}>{a.duTotalPct === null ? NA : fmtNum(a.duTotalPct, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[9px] text-[#4a5260]">I&apos;z = Iz x K1 x K2 (I7-2011 anexele 5.10, 5.18, 5.19); ΔU include alimentarea tabloului, reactanta neglijata; „E” = lungime estimata.</p>
        </Page>
      )}

      {/* 7. ECHIPARE TABLOURI */}
      {has(7) && (
        <Page footer={footer}>
          <H n={7} title="Echiparea tablourilor" />
          {p.panels.length === 0 ? (
            <NotApplicable why="nu sunt definite tablouri" />
          ) : (
            p.panels.map((t) => {
              const lay = layoutPanel(p, t);
              return (
                <div key={t.id} className="avoid-break mb-4">
                  <p className="text-[11px] font-bold">
                    {t.code} {t.name} · {roomName(t.roomId)} · {p.library.enclosureTypes.find((e) => e.id === t.enclosureTypeId)?.name ?? "cutie nealeasa"} · {lay.usedModules}/{lay.capacity} module · rezerva {lay.reserveModules}
                    {t.parentPanelId && ` · alimentat din ${p.panels.find((x) => x.id === t.parentPanelId)?.code} cu ${p.library.cableTypes.find((c) => c.id === t.feeder.cableTypeId)?.name ?? "—"}, ${prov(t.feeder.lengthM, " m")}`}
                  </p>
                  <table className={T}>
                    <thead><tr><th className={TH}>Element</th><th className={TH}>Rol</th><th className={TH}>Aparat</th><th className={TH}>Module</th><th className={TH}>Circuite / aval</th><th className={TH}>Rand</th></tr></thead>
                    <tbody>
                      {t.items.map((it) => {
                        const d = deviceOf(p, it);
                        const row = lay.placed.find((x) => x.item.id === it.id)?.row;
                        return (
                          <tr key={it.id}>
                            <td className={TD}>{it.code}</td>
                            <td className={TD}>{it.role ?? "—"}</td>
                            <td className={TD}>{d ? `${d.name} · ${d.brand}` : it.isSpare ? "rezerva" : "de stabilit"}</td>
                            <td className={TDN}>{d?.modules ?? 2}</td>
                            <td className={TD}>{it.circuitIds.map((id) => p.circuits.find((c) => c.id === id)?.code).join(", ") || (it.downstreamItemIds.length ? `${it.downstreamItemIds.length} aparate in aval` : it.label)}</td>
                            <td className={TDN}>{row === undefined ? "nu incape" : row + 1}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </Page>
      )}

      {/* 8. VEDERE FIZICA */}
      {has(8) &&
        (p.panels.length === 0 ? (
          <Page footer={footer}>
            <H n={8} title="Vedere fizica tablouri" />
            <NotApplicable why="nu sunt definite tablouri" />
          </Page>
        ) : (
          p.panels.map((t, i) => (
            <Page key={t.id} footer={footer}>
              {i === 0 && <H n={8} title="Vedere fizica tablouri" sub="Aparatele pe sina DIN, in ordinea si pe randurile din tablou" />}
              <p className="mb-2 text-[11px] font-bold">{t.code} {t.name}</p>
              <DinView p={p} panel={t} />
            </Page>
          ))
        ))}

      {/* 9. SCHEME MONOFILARE */}
      {has(9) &&
        (p.panels.length === 0 ? (
          <Page footer={footer}>
            <H n={9} title="Scheme monofilare" />
            <NotApplicable why="nu sunt definite tablouri" />
          </Page>
        ) : (
          p.panels.map((t) => (
            <Page key={t.id} footer={footer} landscape>
              <div className="h-[640px] [&>svg]:h-full [&>svg]:w-full">
                <SingleLine p={p} panel={t} />
              </div>
            </Page>
          ))
        ))}

      {/* 10. VERIFICARI */}
      {has(10) && (
        <Page footer={footer}>
          <H n={10} title="Verificari tehnice" sub="Verificari de calcul pe baza datelor introduse; masuratorile fizice sunt listate separat" />
          <p className="mb-2 text-[10.5px]">
            Neconforme <b>{stats.neconform}</b> · avertizari <b>{stats.avertizare}</b> · date insuficiente <b>{stats.date_insuficiente}</b> · indeplinite cu regula validata <b>{stats.conform}</b> · indeplinite, regula nevalidata <b>{stats.conformNevalidat}</b>
          </p>
          <table className={T}>
            <thead><tr><th className={TH}>Element</th><th className={TH}>Verificare</th><th className={TH}>Rezultat</th><th className={TH}>Detalii</th><th className={TH}>Regula</th></tr></thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.key} className="avoid-break">
                  <td className={TD}>{c.targetCode}</td>
                  <td className={TD}>{c.title}</td>
                  <td className={TD + " font-bold"}>{c.result === "conform" ? (c.ruleValidated ? "Conform" : "Indeplinit (regula nevalidata)") : c.result === "date_insuficiente" ? "Date insuficiente" : c.result.charAt(0).toUpperCase() + c.result.slice(1)}</td>
                  <td className={TD}>{c.message}</td>
                  <td className={TD}>{c.ruleCode} {c.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-1 mt-4 text-[11px] font-bold">Masuratori efectuate</p>
          {p.measurements.length === 0 ? (
            <p className="text-[10.5px] text-[#4a5260]">Nu au fost inregistrate masuratori. Rezultatele masuratorilor nu se presupun.</p>
          ) : (
            <table className={T}>
              <thead><tr><th className={TH}>Tip</th><th className={TH}>Element</th><th className={TH}>Valoare</th><th className={TH}>Criteriu</th><th className={TH}>Rezultat</th><th className={TH}>Aparat</th><th className={TH}>Data</th><th className={TH}>Persoana</th></tr></thead>
              <tbody>
                {p.measurements.map((m) => (
                  <tr key={m.id}>
                    <td className={TD}>{m.kind.replace(/_/g, " ")}</td>
                    <td className={TD}>{m.targetKind === "circuit" ? p.circuits.find((c) => c.id === m.targetId)?.code : m.targetKind === "panel" ? p.panels.find((t) => t.id === m.targetId)?.code : "proiect"}</td>
                    <td className={TDN}>{m.value === null ? NA : `${fmtNum(m.value, 3)} ${m.unit}`}</td>
                    <td className={TD}>{m.limit}</td>
                    <td className={TD}>{m.result}</td>
                    <td className={TD}>{m.instrument}</td>
                    <td className={TD}>{m.date}</td>
                    <td className={TD}>{m.person}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[9px] text-[#4a5260]">O verificare individuala reusita nu demonstreaza conformitatea intregului proiect. Regulile se valideaza de persoana autorizata fata de reglementarile in vigoare.</p>
        </Page>
      )}

      {/* 11. PLAN DE EXECUTIE */}
      {has(11) && (
        <Page footer={footer}>
          <H n={11} title="Plan de executie" sub="Versiune preliminara: operatii, cantitati si durate din deviz; dependentele si planificarea detaliata se completeaza in etapa 6" />
          {sched.tasks.length === 0 ? (
            <NotApplicable why="nu exista operatii cu cantitati" />
          ) : (
            <>
              {p.library.planStages
                .sort((a, b) => a.order - b.order)
                .map((st) => {
                  const ts = sched.tasks.filter((t) => t.stageId === st.id);
                  if (!ts.length) return null;
                  return (
                    <div key={st.id} className="avoid-break mb-3">
                      <p className="text-[11px] font-bold">{st.order}. {st.name}</p>
                      <table className={T}>
                        <tbody>
                          {ts.map((t) => {
                            const line = s.labor.lines.find((l) => l.operation.id === t.operationId);
                            return (
                              <tr key={t.operationId}>
                                <td className={TD}>
                                  {t.name}
                                  {line?.operation.subactions.length ? <div className="text-[9px] text-[#4a5260]">{line.operation.subactions.join(" · ")}</div> : null}
                                </td>
                                <td className={TDN + " w-24"}>{line ? `${fmtNum(line.quantity, 1)} ${line.operation.unit}` : ""}</td>
                                <td className={TDN + " w-20"}>{fmtNum(t.hours, 1)} h</td>
                                <td className={TD + " w-40 text-[9px]"}>{t.dependsOn.length ? "dupa: " + t.dependsOn.map((d) => sched.tasks.find((x) => x.operationId === d)?.name).filter(Boolean).join(", ") : ""}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              <p className="text-[10.5px]">
                Echipa: {p.team.electricians} electricieni + {p.team.helpers} ajutoare, {p.team.hoursPerDay} h/zi · ore-om {fmtNum(sched.personHours, 1)} · durata estimata {sched.workDays === null ? NA : fmtNum(sched.workDays, 1)} zile lucratoare
                {sched.calendarDays !== null && ` (${sched.calendarDays} zile calendaristice)`}
              </p>
            </>
          )}
        </Page>
      )}

      {/* 12. DEVIZ */}
      {has(12) && (
        <Page footer={footer}>
          <H n={12} title="Deviz" sub={`${doc.scopeLabel} · ${p.quote.includeMaterials ? "manopera si materiale" : "doar manopera"}`} />
          <table className={T}>
            <thead><tr><th className={TH}>Nr.</th><th className={TH}>Operatie</th><th className={TH}>UM</th><th className={TH}>Cant.</th><th className={TH}>Pret unitar</th><th className={TH}>Valoare</th></tr></thead>
            <tbody>
              {doc.laborRows.map((r, i) => (
                <tr key={i}><td className={TD}>{i + 1}</td><td className={TD}>{r.name}</td><td className={TD}>{r.unit}</td><td className={TDN}>{fmtNum(r.quantity, 2)}</td><td className={TDN}>{fmtMoney(r.unitPrice, "")}</td><td className={TDN}>{fmtMoney(r.value, cur)}</td></tr>
              ))}
              {doc.extras.map((r, i) => (
                <tr key={"e" + i}><td className={TD}>{r.code}</td><td className={TD} colSpan={4}>{r.name}</td><td className={TDN}>{fmtMoney(r.value, cur)}</td></tr>
              ))}
            </tbody>
          </table>
          {doc.materialRows.length > 0 && (
            <table className={T + " mt-3"}>
              <thead><tr><th className={TH}>Nr.</th><th className={TH}>Material</th><th className={TH}>UM</th><th className={TH}>Cant.</th><th className={TH}>Pret unitar</th><th className={TH}>Valoare</th></tr></thead>
              <tbody>
                {doc.materialRows.map((r, i) => (
                  <tr key={i}><td className={TD}>{i + 1}</td><td className={TD}>{r.name}</td><td className={TD}>{r.unit}</td><td className={TDN}>{fmtNum(r.quantity, 2)}</td><td className={TDN}>{fmtMoney(r.unitPrice, "")}</td><td className={TDN}>{fmtMoney(r.value, cur)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <table className={T + " ml-auto mt-3 max-w-[320px]"}>
            <tbody>
              <tr><td className={TD}>Manopera</td><td className={TDN}>{fmtMoney(doc.totals.laborSubtotal, cur)}</td></tr>
              {doc.totals.laborDiscount > 0 && <tr><td className={TD}>Discount manopera</td><td className={TDN}>-{fmtMoney(doc.totals.laborDiscount, cur)}</td></tr>}
              {doc.totals.materialsSubtotal !== null && <tr><td className={TD}>Materiale</td><td className={TDN}>{fmtMoney(doc.totals.materialsSubtotal, cur)}</td></tr>}
              <tr><td className={TD}>{doc.totals.vatPayer ? `TVA ${doc.totals.vatRatePct}%` : f.vatNote}</td><td className={TDN}>{doc.totals.vatPayer ? fmtMoney(doc.totals.vat, cur) : "—"}</td></tr>
              <tr className="font-bold"><td className={TD}>TOTAL</td><td className={TDN}>{fmtMoney(doc.totals.gross, cur)}</td></tr>
              <tr><td className={TD}>Timp manopera / tarif orar implicit</td><td className={TDN}>{fmtNum(doc.hours, 1)} h / {s.labor.impliedHourlyRate === null ? NA : fmtNum(s.labor.impliedHourlyRate, 0) + " lei/h"}</td></tr>
            </tbody>
          </table>
        </Page>
      )}

      {/* 13. ANEXE GRAFICE */}
      {has(13) && (
        <Page footer={footer}>
          <H n={13} title="Anexe grafice" />
          <p className="mb-2 text-[10.5px]">Schemele monofilare (cap. 9) si vederile fizice ale tablourilor (cap. 8) fac parte din anexele grafice.</p>
          <NotApplicable why="planurile de arhitectura, pozitionarea grafica a punctelor si fotografiile de santier nu sunt importate in aceasta versiune a aplicatiei" />
          <p className="mb-1 mt-4 text-[11px] font-bold">Legenda identificatorilor</p>
          <table className={T + " max-w-[420px]"}>
            <tbody>
              {[["DA", "doza aparat"], ["DD", "doza derivatie"], ["AP", "aparat (priza, intrerupator, echipament)"], ["IL", "punct de iluminat"], ["CI", "circuit"], ["TA", "tablou"], ["TR", "traseu fizic"], ["CP", "tub de protectie / copex"], ["CB", "cablu"], ["EM", "element (aparat modular) in tablou"]].map(([k, v]) => (
                <tr key={k}><td className={TD + " w-14 font-bold"}>{k}</td><td className={TD}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </Page>
      )}

      {/* 14. OBSERVATII SI CONTROL */}
      {has(14) && (
        <Page footer={footer}>
          <H n={14} title="Observatii si control" sub="Registru de ipoteze si neconformitati, date neconfirmate, istoric revizii, semnaturi" />
          <table className={T}>
            <thead><tr><th className={TH}>Categorie</th><th className={TH}>Descriere</th><th className={TH}>Recomandare</th><th className={TH}>Responsabil / stare</th></tr></thead>
            <tbody>
              {p.register.map((e) => (
                <tr key={e.id} className="avoid-break"><td className={TD}>{REGISTER_CATEGORY_LABEL[e.category]}</td><td className={TD}>{e.text}</td><td className={TD}>{e.recommendation}</td><td className={TD}>{e.responsible} · {e.resolved ? "rezolvat" : "deschis"}</td></tr>
              ))}
              {reg.map((e, i) => (
                <tr key={"a" + i} className="avoid-break"><td className={TD}>{REGISTER_CATEGORY_LABEL[e.category]}</td><td className={TD}>{e.text}</td><td className={TD}>{e.recommendation}</td><td className={TD + " text-[#6f7682]"}>generat automat</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mb-1 mt-4 text-[11px] font-bold">Istoric revizii</p>
          {p.issued.length === 0 ? (
            <p className="text-[10.5px] text-[#4a5260]">Nicio versiune emisa anterior.</p>
          ) : (
            <table className={T}>
              <thead><tr><th className={TH}>Revizie</th><th className={TH}>Document</th><th className={TH}>Data</th><th className={TH}>Motiv</th><th className={TH}>Manopera</th><th className={TH}>Materiale</th></tr></thead>
              <tbody>
                {p.issued.map((v) => (
                  <tr key={v.id}><td className={TD}>{revLabel(v.number)}</td><td className={TD}>{DOC_KIND_LABEL[v.docKind]}</td><td className={TD}>{fmtDate(v.issuedAt)}</td><td className={TD}>{v.reason}</td><td className={TDN}>{fmtMoney(v.totals.laborValue, cur)}</td><td className={TDN}>{v.totals.materialsValue === null ? "—" : fmtMoney(v.totals.materialsValue, cur)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-10 grid grid-cols-3 gap-6 text-[10.5px]">
            {["Intocmit (electrician autorizat)", "Verificat", "Beneficiar"].map((r) => (
              <div key={r}>
                <p className="font-bold">{r}</p>
                <p>{r.startsWith("Intocmit") ? `${f.designer} · ANRE ${f.anreGrade} nr. ${f.anreAuthorization}` : " "}</p>
                <div className="mt-10 border-t border-[#8a919c] pt-1 text-[9px] text-[#6f7682]">nume, semnatura, data</div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[8.5px] text-[#4a5260]">Aplicatia este un instrument de asistenta pentru configurare, calcul, ofertare si documentare. Nu inlocuieste proiectarea / verificarea de specialitate, masuratorile efective sau responsabilitatea persoanei autorizate.</p>
        </Page>
      )}
    </div>
  );
});
