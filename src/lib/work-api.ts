import type { WorkTask } from './work-order';
export const TASK_FIELDS =
  'id species title location materialsLocation doneWhen done spanish { title location materialsLocation doneWhen } status helpNote revision';
export async function query<T>(source: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: source, variables }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length)
    throw new Error(
      payload.errors?.[0]?.message ?? payload.error ?? 'Could not connect. Please try again.',
    );
  return payload.data as T;
}
export async function loadTasks(orchardId: string, initialize = false): Promise<WorkTask[]> {
  if (initialize)
    return (
      await query<{ startOrchard: WorkTask[] }>(
        'mutation Start($orchardId: ID!) { startOrchard(orchardId: $orchardId) { ' +
          TASK_FIELDS +
          ' } }',
        { orchardId },
      )
    ).startOrchard;
  return (
    await query<{ tasks: WorkTask[] }>(
      'query Tasks($orchardId: ID!) { tasks(orchardId: $orchardId) { ' + TASK_FIELDS + ' } }',
      { orchardId },
    )
  ).tasks;
}
