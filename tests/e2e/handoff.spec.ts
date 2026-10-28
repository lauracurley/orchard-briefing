import { test, expect, type Page } from '@playwright/test';
import { EXAMPLES, type WorkTask } from '../../src/lib/work-order';

async function mockWorkspace(page: Page) {
  let tasks: WorkTask[] = EXAMPLES.map((example, index) => ({
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
  const paidRequests: string[] = [];
  let failSave = false;
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (
      /\/(briefing|transcribe|agent-session)(\/|$)/.test(url) ||
      url.endsWith('/task-audio/create')
    ) {
      paidRequests.push(url);
      await route.abort();
      return;
    }
    if (url.endsWith('/task-audio')) {
      await route.fulfill({ json: { available: false } });
      return;
    }
    if (url.endsWith('/recordings')) {
      await route.fulfill({ json: { recordings: [] } });
      return;
    }
    if (!url.endsWith('/graphql')) {
      await route.continue();
      return;
    }
    const { query, variables: v } = route.request().postDataJSON();
    if (query.includes('saveTask')) {
      if (failSave) {
        await route.fulfill({
          json: { errors: [{ message: 'Connection lost. Your draft has been kept.' }] },
        });
        return;
      }
      const item: WorkTask = {
        ...v.input.english,
        species: v.input.species,
        spanish: v.input.spanish,
        german: v.input.german,
        id: v.taskId ?? String(tasks.length + 1),
        revision: (v.revision ?? 0) + 1,
        status: 'ready',
        done: false,
        helpNote: '',
      };
      tasks = v.taskId ? tasks.map((t) => (t.id === v.taskId ? item : t)) : [item, ...tasks];
      await route.fulfill({ json: { data: { saveTask: item } } });
    } else if (query.includes('setWorkStatus')) {
      const old = tasks.find((t) => t.id === v.taskId)!;
      const item: WorkTask = {
        ...old,
        status: v.status,
        helpNote: v.status === 'blocked' ? v.helpNote : '',
        done: v.status === 'done',
        revision: old.revision + 1,
      };
      tasks = tasks.map((t) => (t.id === item.id ? item : t));
      await route.fulfill({ json: { data: { setWorkStatus: item } } });
    } else
      await route.fulfill({
        json: { data: { [query.includes('startOrchard') ? 'startOrchard' : 'tasks']: tasks } },
      });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Prepare a task' })).toBeEnabled({
    timeout: 30000,
  });
  return {
    paidRequests,
    failSaving: () => {
      failSave = true;
    },
  };
}

test('review, publish, complete in Spanish, then see management progress without paid calls', async ({
  page,
}) => {
  test.setTimeout(90000);
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: 'Try a translated example' }).click();
  await expect(page.getByRole('button', { name: 'Publish task' })).toBeDisabled();
  await page
    .getByRole('group', { name: 'English', exact: true })
    .getByLabel('What needs doing?')
    .fill('Check guards before lunch');
  await page
    .getByRole('group', { name: 'Español', exact: true })
    .getByLabel('¿Qué hay que hacer?')
    .fill('Revisar protectores antes del almuerzo');
  await page.getByRole('checkbox', { name: /I checked/ }).check();
  await page.getByRole('button', { name: 'Publish task' }).click();
  await expect(page.getByRole('status')).toContainText('Published');
  await page.getByRole('button', { name: 'Today’s tasks', exact: true }).click();
  await page.getByRole('button', { name: 'Español', exact: true }).click();
  const card = page.getByRole('article', { name: 'Revisar protectores antes del almuerzo' });
  await expect(card).toContainText('North Shed');
  await card.getByRole('button', { name: 'Empezar', exact: true }).click();
  await card.getByRole('button', { name: 'Marcar terminada' }).click();
  await expect(card).toContainText('Terminada');
  await page.getByRole('button', { name: 'Planificar trabajo', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Check guards before lunch' })).toContainText(
    'Done',
  );
  expect(api.paidRequests).toEqual([]);
});

test('draft survives reload and a failed publication keeps the editor intact', async ({ page }) => {
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: 'Prepare a task' }).click();
  await page.getByLabel('Your rough note').fill('Check the walnut guards by the gate.');
  await page.reload();
  await page.getByRole('button', { name: 'Continue draft' }).click();
  await expect(page.getByLabel('Your rough note')).toHaveValue(
    'Check the walnut guards by the gate.',
  );
  await page.getByRole('button', { name: 'Review instructions', exact: false }).click();
  await page.getByLabel('Where is the work?').fill('Gate');
  await page.getByLabel('Finished when…', { exact: true }).fill('All guards checked');
  await page.getByRole('checkbox', { name: /I checked/ }).check();
  api.failSaving();
  await page.getByRole('button', { name: 'Publish task' }).click();
  await expect(
    page.getByRole('region', { name: 'Review the instructions' }).getByRole('alert'),
  ).toContainText('Your draft has been kept');
  await expect(page.getByLabel('Where is the work?')).toHaveValue('Gate');
});

test('worker reports a blocker that management can see', async ({ page }) => {
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: 'Today’s tasks', exact: true }).click();
  const card = page.getByRole('article', { name: EXAMPLES[0].english.title });
  await card.getByRole('button', { name: 'Need help' }).click();
  await card.getByLabel('What do you need to continue?').fill('The north shed is locked.');
  await card.getByRole('button', { name: 'Send help request' }).click();
  await page.getByRole('button', { name: 'Plan work', exact: true }).click();
  await page.getByRole('button', { name: 'Needs help 1', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('The north shed is locked.');
  expect(api.paidRequests).toEqual([]);
});

test('editing English requires a new review and preserves the materials location', async ({
  page,
}) => {
  await mockWorkspace(page);
  const card = page.getByRole('article', { name: EXAMPLES[0].english.title });
  await card.getByRole('button', { name: 'Edit instructions' }).click();
  await page.getByRole('checkbox', { name: /I checked/ }).check();
  await page
    .getByRole('group', { name: 'English', exact: true })
    .getByLabel('Materials and where to find them')
    .fill('Spare ties: Office');
  await expect(page.getByRole('button', { name: 'Publish changes' })).toBeDisabled();
  await page
    .getByRole('group', { name: 'Español', exact: true })
    .getByLabel('Materiales y dónde encontrarlos')
    .fill('Ataduras: Office');
  await page.getByRole('checkbox', { name: /I checked/ }).check();
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(card).toContainText('Spare ties: Office');
});

test('layout fits the viewport and Spanish worker view is localized', async ({
  page,
}, testInfo) => {
  await mockWorkspace(page);
  await page.screenshot({ path: testInfo.outputPath('management.png'), fullPage: true });
  await page.getByRole('button', { name: 'Today’s tasks', exact: true }).click();
  await page.getByRole('button', { name: 'Español', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tareas de hoy.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All tasks' })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('worker-es.png'), fullPage: true });
});

test('server rejects live capture even when the request is made directly', async ({ request }) => {
  for (const endpoint of ['transcribe', 'agent-session']) {
    const response = await request.post('/api/' + endpoint, { data: {} });
    expect(response.status()).toBe(503);
  }
});

test('German instructions can be edited, published, completed and retained after reload', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: 'Try a translated example' }).click();
  await page
    .getByRole('group', { name: 'English', exact: true })
    .getByLabel('What needs doing?')
    .fill('Check guards for the German handoff');
  const german = page.getByRole('group', { name: 'Deutsch', exact: true });
  await german.getByLabel('Was ist zu tun?').fill('Baumschutz vor Mittag prüfen');
  await german.getByLabel('Material und Aufbewahrungsort').fill('Bindematerial: Office');
  await page.getByRole('checkbox', { name: /I checked/ }).check();
  await page.getByRole('button', { name: 'Publish task', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Published');
  await page.getByRole('button', { name: 'Today’s tasks', exact: true }).click();
  await page.getByRole('button', { name: 'Deutsch', exact: true }).click();
  const card = page.getByRole('article', { name: 'Baumschutz vor Mittag prüfen' });
  await expect(card).toContainText('Bindematerial: Office');
  await card.getByRole('button', { name: 'Aufgabe beginnen' }).click();
  await card.getByRole('button', { name: 'Als erledigt markieren' }).click();
  await expect(card).toContainText('Erledigt');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Heutige Aufgaben.' })).toBeVisible();
  await expect(card).toContainText('Erledigt');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('tasks-de.png'), fullPage: true });
  await page.getByRole('button', { name: 'Arbeit planen', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Check guards for the German handoff', exact: true }),
  ).toContainText('Done');
  expect(api.paidRequests).toEqual([]);
});
test('missing German is explicit and cannot start work, while help is still available', async ({
  page,
}) => {
  const api = await mockWorkspace(page);
  await page
    .getByRole('article', { name: EXAMPLES[0].english.title })
    .getByRole('button', { name: 'Edit instructions' })
    .click();
  await page.getByRole('checkbox', { name: 'Include German instructions' }).uncheck();
  await page.getByRole('checkbox', { name: /I checked/ }).check();
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByRole('status')).toContainText('Published');
  await page.getByRole('button', { name: 'Today’s tasks', exact: true }).click();
  await page.getByRole('button', { name: 'Deutsch', exact: true }).click();
  const card = page.getByRole('article', { name: EXAMPLES[0].english.title });
  await expect(card).toContainText('Die deutschen Anweisungen sind noch nicht verfügbar');
  await expect(card.getByRole('button', { name: 'Aufgabe beginnen' })).toBeDisabled();
  await card.getByText('Englisches Original anzeigen').click();
  await expect(card.getByText('Where: East fence')).toBeVisible();
  await card.getByRole('button', { name: 'Hilfe benötigt', exact: true }).click();
  await card
    .getByLabel('Was brauchst du, um weiterzumachen?')
    .fill('Bitte deutsche Anweisungen ergänzen.');
  await card.getByRole('button', { name: 'Hilfe anfragen' }).click();
  await expect(card).toContainText('Bitte deutsche Anweisungen ergänzen.');
  expect(api.paidRequests).toEqual([]);
});

test('recording is explicit, quota feedback is clear, and saved playback needs no generation', async ({
  page,
}) => {
  test.setTimeout(90000);
  await mockWorkspace(page);
  let generations = 0;
  let cached = false;
  // A tiny WAV fixture; no provider call is made by this browser test.
  const wav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=', 'base64');
  await page.route('**/api/task-audio/create', async (route) => {
    generations++;
    if (generations === 1)
      await route.fulfill({ status: 429, json: { error: 'Allowance reached' } });
    else {
      cached = true;
      await route.fulfill({ contentType: 'audio/wav', body: wav });
    }
  });
  await page.route('**/api/task-audio', async (route) => {
    if (cached) await route.fulfill({ contentType: 'audio/wav', body: wav });
    else await route.fulfill({ json: { available: false } });
  });
  const card = page.getByRole('article', { name: EXAMPLES[0].english.title });
  expect(generations).toBe(0);
  await card.getByRole('button', { name: 'Create recording', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('New recordings are unavailable right now');
  await card.getByRole('button', { name: 'Create recording', exact: true }).click();
  await expect(card.locator('audio')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Create recording' })).toHaveCount(0);
  await page.reload();
  await expect(card.locator('audio')).toBeVisible();
  expect(generations).toBe(2);
});
