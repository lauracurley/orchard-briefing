// Local, in-memory design preview. It intercepts API requests in a dedicated
// Chrome window and never writes fictional tasks to the configured database.
import { chromium } from '@playwright/test';
import { EXAMPLES } from '../src/lib/work-order.ts';

const baseURL = process.env.ORCHARD_PREVIEW_URL ?? 'http://127.0.0.1:3100';
let tasks = EXAMPLES.map((example, index) => ({
  ...example.english,
  id: String(index + 1),
  species: example.species,
  spanish: example.spanish,
  german: example.german,
  status: 'ready',
  revision: 1,
  done: false,
  helpNote: '',
}));

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.route('**/api/**', async (route) => {
  const url = route.request().url();
  if (url.endsWith('/task-audio')) {
    await route.fulfill({ json: { available: false } });
    return;
  }
  if (url.endsWith('/recordings')) {
    await route.fulfill({ json: { recordings: [] } });
    return;
  }
  if (!url.endsWith('/graphql')) {
    await route.abort();
    return;
  }
  const { query, variables = {} } = route.request().postDataJSON();
  if (query.includes('saveTask')) {
    const old = tasks.find((task) => task.id === variables.taskId);
    const item = {
      ...variables.input.english,
      species: variables.input.species,
      spanish: variables.input.spanish,
      german: variables.input.german,
      id: variables.taskId ?? String(tasks.length + 1),
      revision: (old?.revision ?? 0) + 1,
      status: old?.status ?? 'ready',
      done: old?.done ?? false,
      helpNote: old?.helpNote ?? '',
    };
    tasks = old ? tasks.map((task) => (task.id === item.id ? item : task)) : [item, ...tasks];
    await route.fulfill({ json: { data: { saveTask: item } } });
  } else if (query.includes('setWorkStatus')) {
    const old = tasks.find((task) => task.id === variables.taskId);
    if (!old) {
      await route.fulfill({ json: { errors: [{ message: 'Task not found' }] } });
      return;
    }
    const item = {
      ...old,
      status: variables.status,
      helpNote: variables.status === 'blocked' ? variables.helpNote : '',
      done: variables.status === 'done',
      revision: old.revision + 1,
    };
    tasks = tasks.map((task) => (task.id === item.id ? item : task));
    await route.fulfill({ json: { data: { setWorkStatus: item } } });
  } else {
    await route.fulfill({
      json: { data: { [query.includes('startOrchard') ? 'startOrchard' : 'tasks']: tasks } },
    });
  }
});

await page.goto(baseURL);
await page.getByRole('button', { name: 'Prepare a task' }).waitFor();
console.log(`Orchard design preview is open in Chrome at ${baseURL}. Press Ctrl+C to close it.`);
await new Promise((resolve) => {
  process.once('SIGINT', resolve);
  browser.once('disconnected', resolve);
});
if (browser.isConnected()) await browser.close();
