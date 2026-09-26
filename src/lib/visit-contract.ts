export const visitStatuses = [
  "arrived",
  "handed_over",
  "in_progress",
  "ready",
  "collected",
] as const;

export type VisitStatus = (typeof visitStatuses)[number];

export const visitLabels: Record<VisitStatus, string> = {
  arrived: "Arrived",
  handed_over: "Handed over",
  in_progress: "In progress",
  ready: "Ready for collection",
  collected: "Collected",
};
