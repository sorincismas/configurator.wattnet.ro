/**
 * Durata calendaristica estimata (cap. 12.2) - versiune initiala.
 *
 * Nu se presupune ca orele se impart perfect la numarul de persoane:
 *  - operatiile "neparalelizabile" se executa de o singura persoana;
 *  - dependentele impun succesiunea (drum critic);
 *  - durata = max(drum critic, ore-om totale / capacitatea echipei).
 * Rezultatul este o estimare; se poate ajusta manual per operatie.
 */
import type { Project } from "../model/types";
import type { LaborResult } from "./pricing";
import { round } from "./measure";

export interface ScheduleTask {
  operationId: string;
  name: string;
  stageId: string | null;
  standardHours: number;
  manualHours: number | null;
  hours: number;
  crew: number;
  durationH: number;
  startH: number;
  endH: number;
  dependsOn: string[];
}

export interface ScheduleResult {
  tasks: ScheduleTask[];
  personHours: number;
  crewCapacity: number;
  criticalPathH: number;
  workHours: number;
  workDays: number | null;
  calendarDays: number | null;
  endDate: string | null;
}

export function computeSchedule(p: Project, labor: LaborResult): ScheduleResult {
  const t = p.team;
  const crew = Math.max(0, t.electricians) + Math.max(0, t.helpers) * t.helperEfficiency;
  const overrides = new Map(p.planOverrides.map((o) => [o.operationId, o] as const));
  const lines = labor.lines.filter((l) => l.enabled && l.timeMin > 0);
  const ids = new Set(lines.map((l) => l.operation.id));

  const tasks: ScheduleTask[] = lines.map((l) => {
    const std = round(l.timeMin / 60, 2);
    const manual = overrides.get(l.operation.id)?.manualHours ?? null;
    const hours = manual ?? std;
    const taskCrew = l.operation.parallelizable ? Math.max(crew, 1) : Math.min(1, Math.max(crew, 1));
    return {
      operationId: l.operation.id,
      name: l.operation.name,
      stageId: l.operation.planStageId,
      standardHours: std,
      manualHours: manual,
      hours,
      crew: taskCrew,
      durationH: round(hours / taskCrew, 2),
      startH: 0,
      endH: 0,
      dependsOn: l.operation.dependsOn.filter((d) => ids.has(d)),
    };
  });

  // drum critic (fara cicluri: dependentele se rezolva iterativ)
  const byId = new Map(tasks.map((x) => [x.operationId, x] as const));
  const done = new Set<string>();
  let guard = 0;
  while (done.size < tasks.length && guard++ < tasks.length + 5) {
    for (const task of tasks) {
      if (done.has(task.operationId)) continue;
      if (!task.dependsOn.every((d) => done.has(d))) continue;
      task.startH = Math.max(0, ...task.dependsOn.map((d) => byId.get(d)!.endH));
      task.endH = round(task.startH + task.durationH, 2);
      done.add(task.operationId);
    }
  }
  // dependente circulare: se plaseaza la final
  for (const task of tasks) if (!done.has(task.operationId)) {
    task.startH = Math.max(0, ...tasks.map((x) => x.endH));
    task.endH = round(task.startH + task.durationH, 2);
  }

  const personHours = round(tasks.reduce((s, x) => s + x.hours, 0), 2);
  const critical = round(Math.max(0, ...tasks.map((x) => x.endH)), 2);
  const capacity = crew > 0 ? crew : 0;
  const workHours = capacity > 0 ? round(Math.max(critical, personHours / capacity), 2) : 0;
  const workDays = capacity > 0 && t.hoursPerDay > 0 ? Math.ceil((workHours / t.hoursPerDay) * 10) / 10 : null;

  let calendarDays: number | null = null;
  let endDate: string | null = null;
  if (workDays !== null && t.workDaysPerWeek > 0) {
    const whole = Math.ceil(workDays);
    // zilele libere se adauga doar intre saptamani de lucru complete
    const wpd = Math.min(7, t.workDaysPerWeek);
    calendarDays = whole + Math.floor(Math.max(0, whole - 1) / wpd) * (7 - wpd);
    if (t.startDate) {
      const d = new Date(t.startDate);
      let left = whole;
      while (left > 0) {
        const wd = d.getDay(); // 0 duminica
        const isWork = t.workDaysPerWeek >= 7 || (t.workDaysPerWeek === 6 ? wd !== 0 : wd !== 0 && wd !== 6);
        if (isWork) left--;
        if (left > 0) d.setDate(d.getDate() + 1);
      }
      endDate = d.toISOString().slice(0, 10);
    }
  }

  return { tasks, personHours, crewCapacity: capacity, criticalPathH: critical, workHours, workDays, calendarDays, endDate };
}
