import { ChecklistFinding, ChecklistItem } from "../types/diagnostics";

export const mergeFindings = (
  items: ChecklistItem[],
  findings: ChecklistFinding[],
  seenAt: Date,
): ChecklistItem[] => {
  const updated = items.map((item) => {
    const seenAgain = findings.find((finding) => finding.code === item.code);
    if (!seenAgain) return item;

    return {
      ...item,
      title: seenAgain.title,
      why: seenAgain.why,
      priority: seenAgain.priority,
      lastSeenAt: seenAt,
    };
  });

  const known = new Set(items.map((item) => item.code));
  const opened = findings
    .filter((finding) => !known.has(finding.code))
    .map((finding) => ({
      code: finding.code,
      title: finding.title,
      why: finding.why,
      priority: finding.priority,
      createdAt: seenAt,
      lastSeenAt: seenAt,
      doneAt: null,
    }));

  return [...updated, ...opened];
};

export const setItemDone = (
  items: ChecklistItem[],
  code: string,
  done: boolean,
  at: Date,
): ChecklistItem[] =>
  items.map((item) =>
    item.code === code ? { ...item, doneAt: done ? at : null } : item,
  );

export const removeItem = (
  items: ChecklistItem[],
  code: string,
): ChecklistItem[] => items.filter((item) => item.code !== code);

export const hasItem = (items: ChecklistItem[], code: string): boolean =>
  items.some((item) => item.code === code);

export const openItems = (items: ChecklistItem[]): ChecklistItem[] =>
  items.filter((item) => item.doneAt === null);

export const doneItems = (items: ChecklistItem[]): ChecklistItem[] =>
  items.filter((item) => item.doneAt !== null);
