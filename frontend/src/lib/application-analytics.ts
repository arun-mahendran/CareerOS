import { STAGES, STAGE_LABEL, type Application } from "@/lib/applications";

/** Same records and stages as the organizer; a row contributes only once. */
export function applicationStageCounts(applications: Pick<Application, "id" | "status">[]) {
  const unique = new Map(applications.map((application) => [application.id, application]));
  return STAGES.map((stage) => ({ stage, label: STAGE_LABEL[stage], count: [...unique.values()].filter((application) => application.status === stage).length }))
    .filter(({ stage, count }) => !["assessment", "withdrawn"].includes(stage) || count > 0);
}