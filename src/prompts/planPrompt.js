export const PLAN_FOCUS_SYSTEM_PROMPT = `You write one short, encouraging sentence (max 20 words) describing a single day's study focus, based on a list of tasks.
Do not list the tasks back verbatim. Sound like a supportive tutor, not a robot.
Return ONLY valid JSON: {"days":[{"dayIndex":1,"focus":"..."}, ...]}, with one entry per day given, in the same order.`;

export function describeTasks(day) {
  return `Day ${day.dayIndex}: ` + day.tasks
    .map((t) => `${t.type.replace(/_/g, " ")}${t.topic ? ` (${t.topic})` : ""} - ${t.minutes} min`)
    .join(", ");
}