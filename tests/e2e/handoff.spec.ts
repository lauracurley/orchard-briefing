import { test, expect, type Page } from '@playwright/test';
import { EXAMPLES, type WorkTask } from '../../src/lib/work-order';

async function mockWorkspace(page: Page) {
  let tasks: WorkTask[] = EXAMPLES.map((example, index) => ({
    ...example.english,
    id: String(index + 1),
    species: example.species,
    spanish: example.spanish,
    status: 'ready',
    revision: 1,
    done: false,
    helpNote: '',
  }));
  const paidRequests: string[] = [];
  let failSave = false;
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (/\/(briefing|transcribe|agent-session)(\/|$)/.test(url)) {
      paidRequests.push(url);
      await route.abort();
      return;
    }
    if (url.endsWith('/task-audio')) {
      await route.fulfill({ json: { available: false } });
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
  await expect(page.getByRole('button', { name: '+ New task' })).toBeEnabled();
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
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: 'Try a bilingual example' }).click();
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
  await page.getByRole('button', { name: 'Worker', exact: true }).click();
  await page.getByRole('button', { name: 'Español', exact: true }).click();
  const card = page.getByRole('article', { name: 'Revisar protectores antes del almuerzo' });
  await expect(card).toContainText('North Shed');
  await card.getByRole('button', { name: 'Empezar', exact: true }).click();
  await card.getByRole('button', { name: 'Marcar terminada' }).click();
  await expect(card).toContainText('Terminada');
  await page.getByRole('button', { name: 'Gestión', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Check guards before lunch' })).toContainText(
    'Done',
  );
  expect(api.paidRequests).toEqual([]);
});

test('draft survives reload and a failed publication keeps the editor intact', async ({ page }) => {
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: '+ New task' }).click();
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
    page.getByRole('region', { name: 'Make it clear before it goes out.' }).getByRole('alert'),
  ).toContainText('Your draft has been kept');
  await expect(page.getByLabel('Where is the work?')).toHaveValue('Gate');
});

test('worker reports a blocker that management can see', async ({ page }) => {
  const api = await mockWorkspace(page);
  await page.getByRole('button', { name: 'Worker', exact: true }).click();
  const card = page.getByRole('article', { name: EXAMPLES[0].english.title });
  await card.getByRole('button', { name: 'Need help' }).click();
  await card.getByLabel('What do you need to continue?').fill('The north shed is locked.');
  await card.getByRole('button', { name: 'Send to manager' }).click();
  await page.getByRole('button', { name: 'Management', exact: true }).click();
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
  await page.getByRole('button', { name: 'Worker', exact: true }).click();
  await page.getByRole('button', { name: 'Español', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'El trabajo de hoy.' })).toBeVisible();
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
