import {
  PROJECT_SLICE_LABELS,
  RESPONSIBLE_OPTIONS,
  UNASSIGNED_RESPONSIBLE,
} from "@/lib/constants";
import type { Employee, InternalArea, ProjectResponsible } from "@/lib/types";

type EmployeeName = Pick<Employee, "full_name"> & Partial<Pick<Employee, "is_active">>;

type ProjectResponsibleFields = {
  proposal_responsible?: string | null;
  modeling_3d_responsible?: string | null;
  plans_responsible?: string | null;
  render_responsible?: string | null;
};

const DEFAULT_PROJECT_RESPONSIBLES: Record<InternalArea, ProjectResponsible> = {
  proposal: "Alejandra",
  modeling_3d: "Esmeralda",
  plans: "Alejandra",
  render: "Esmeralda",
};

const RESPONSIBLE_FIELDS = [
  {
    area: "proposal",
    field: "proposal_responsible",
    taskName: PROJECT_SLICE_LABELS.proposal,
  },
  {
    area: "modeling_3d",
    field: "modeling_3d_responsible",
    taskName: PROJECT_SLICE_LABELS.modeling_3d,
  },
  {
    area: "plans",
    field: "plans_responsible",
    taskName: PROJECT_SLICE_LABELS.plans,
  },
  {
    area: "render",
    field: "render_responsible",
    taskName: PROJECT_SLICE_LABELS.render,
  },
] as const;

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compactName(value: string) {
  return normalizeName(value).replace(/[^a-z0-9]/g, "");
}

function employeeNames(employees: EmployeeName[]) {
  return employees
    .filter((employee) => employee.is_active !== false)
    .map((employee) => employee.full_name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es-MX"));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function getResponsibleOptions(employees: EmployeeName[]): ProjectResponsible[] {
  const names = employeeNames(employees);
  if (names.length === 0) return [...RESPONSIBLE_OPTIONS];
  return unique([...names, UNASSIGNED_RESPONSIBLE]);
}

export function resolveResponsibleToEmployeeName(
  value: string | null | undefined,
  employees: EmployeeName[],
): ProjectResponsible {
  const raw = value?.trim();
  if (!raw) return UNASSIGNED_RESPONSIBLE;
  if (compactName(raw) === compactName(UNASSIGNED_RESPONSIBLE)) {
    return UNASSIGNED_RESPONSIBLE;
  }

  const candidates = employeeNames(employees).map((fullName) => {
    const parts = normalizeName(fullName).split(/\s+/).filter(Boolean);
    return {
      fullName,
      normalized: normalizeName(fullName),
      compact: compactName(fullName),
      firstName: parts[0] ?? "",
      firstNameCompact: compactName(parts[0] ?? ""),
    };
  });

  const normalizedValue = normalizeName(raw);
  const compactValue = compactName(raw);
  const exact = candidates.find((candidate) => candidate.normalized === normalizedValue);
  if (exact) return exact.fullName;

  const firstNameMatches = candidates.filter((candidate) => candidate.firstName === normalizedValue);
  if (firstNameMatches.length === 1) return firstNameMatches[0].fullName;

  const compactMatches = candidates.filter((candidate) =>
    candidate.compact.startsWith(compactValue),
  );
  if (compactMatches.length === 1) return compactMatches[0].fullName;

  const typedFirstNameMatches = candidates.filter(
    (candidate) =>
      candidate.firstNameCompact.length > 0 &&
      compactValue.startsWith(candidate.firstNameCompact),
  );
  if (typedFirstNameMatches.length === 1) return typedFirstNameMatches[0].fullName;

  return raw;
}

export function resolveProjectResponsiblesForEmployees(
  responsibles: Record<InternalArea, ProjectResponsible>,
  employees: EmployeeName[],
): Record<InternalArea, ProjectResponsible> {
  return {
    proposal: resolveResponsibleToEmployeeName(responsibles.proposal, employees),
    modeling_3d: resolveResponsibleToEmployeeName(responsibles.modeling_3d, employees),
    plans: resolveResponsibleToEmployeeName(responsibles.plans, employees),
    render: resolveResponsibleToEmployeeName(responsibles.render, employees),
  };
}

export function getDefaultProjectResponsibles(
  employees: EmployeeName[],
): Record<InternalArea, ProjectResponsible> {
  return resolveProjectResponsiblesForEmployees(DEFAULT_PROJECT_RESPONSIBLES, employees);
}

export function buildProjectSalaryAssignments(
  project: ProjectResponsibleFields,
  employees: EmployeeName[],
) {
  return RESPONSIBLE_FIELDS.map(({ field, taskName }) => ({
    employeeName: resolveResponsibleToEmployeeName(project[field], employees),
    taskName,
  }));
}
