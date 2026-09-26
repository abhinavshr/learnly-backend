const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / MS_PER_DAY);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Builds one day of tasks from a rotating list of study items
function buildTasksForDay(items, startIndex, minutesAvailable) {
  const tasks = [];
  let minutesLeft = minutesAvailable;
  let i = startIndex;

  while (minutesLeft > 10 && items.length) {
    const item = items[i % items.length];
    const minutes = Math.min(item.minutes, minutesLeft);
    tasks.push({ ...item, minutes });
    minutesLeft -= minutes;
    i++;
  }
  return { tasks, nextIndex: i };
}

/**
 * documents: [{ id, title }]
 * weakTopics: [{ documentId, topic }]  (already filtered to isWeak, weakest first)
 */
export function buildSchedule({ documents, weakTopics, examDate, hoursPerDay, today = new Date() }) {
  const totalDays = daysBetween(today, examDate);
  if (totalDays < 1) {
    const err = new Error("Exam date must be at least 1 day in the future");
    err.code = "INVALID_EXAM_DATE";
    throw err;
  }

  const minutesPerDay = Math.round(hoursPerDay * 60);

  // A rotating pool of study items: weak topics first, then a general pass per document
  const items = [
    ...weakTopics.map((w) => ({
      type: "weak_topic_quiz",
      documentId: w.documentId,
      topic: w.topic,
      minutes: 20,
    })),
    ...documents.map((d) => ({
      type: "read_summary",
      documentId: d.id,
      minutes: 15,
    })),
    ...documents.map((d) => ({
      type: "practice_quiz",
      documentId: d.id,
      minutes: 20,
    })),
    ...documents.map((d) => ({
      type: "flashcard_review",
      documentId: d.id,
      minutes: 10,
    })),
  ];

  const days = [];
  let itemIndex = 0;

  for (let i = 0; i < totalDays; i++) {
    const isLastDay = i === totalDays - 1;
    // The last day is lighter: light review only, no new material
    const minutes = isLastDay ? Math.min(minutesPerDay, 45) : minutesPerDay;

    const { tasks, nextIndex } = isLastDay
      ? { tasks: [{ type: "final_review", minutes }], nextIndex: itemIndex }
      : buildTasksForDay(items, itemIndex, minutes);

    itemIndex = nextIndex;
    days.push({
      dayIndex: i + 1,
      date: addDays(today, i),
      tasks,
    });
  }

  return days;
}