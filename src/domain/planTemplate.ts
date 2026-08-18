import { PlanTemplateDocument } from "../types/plan-template";
import { Fuel, Transmission } from "../types/vehicle";

export interface TemplateTarget {
  fuel: Fuel;
  transmission?: Transmission | null;
  modelYear: number;
}

export const matchesTemplate = (
  template: PlanTemplateDocument,
  target: TemplateTarget,
): boolean => {
  if (template.active === false) return false;

  const { fuel, transmission, yearMin, yearMax } = template.criteria ?? {};

  if (fuel?.length && !fuel.includes(target.fuel)) return false;

  if (transmission?.length) {
    if (!target.transmission) return false;
    if (!transmission.includes(target.transmission)) return false;
  }

  if (yearMin != null && target.modelYear < yearMin) return false;
  if (yearMax != null && target.modelYear > yearMax) return false;

  return true;
};

export const selectTemplate = (
  templates: PlanTemplateDocument[],
  target: TemplateTarget,
): PlanTemplateDocument | null => {
  const matching = templates.filter((template) =>
    matchesTemplate(template, target),
  );

  if (!matching.length) return null;

  return matching.reduce((best, current) =>
    current.priority > best.priority ? current : best,
  );
};
