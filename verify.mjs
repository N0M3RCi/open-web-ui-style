import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().substring(0, 200));
});

await page.goto('https://merci-web-deploy.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

const title = await page.title();
const url = page.url();

// Check for tabs in the history tab navigation
const tabTexts = await page.evaluate(() => {
  const tabs = document.querySelectorAll('[role="tab"]');
  return Array.from(tabs).map(t => t.textContent?.trim()).filter(Boolean);
});

// Check if we're on login page
const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');

// Check for history-tab elements
const historyTabTexts = await page.evaluate(() => {
  const buttons = document.querySelectorAll('[data-history-tab]');
  return Array.from(buttons).map(b => b.getAttribute('data-history-tab'));
});

console.log('TITLE:', title);
console.log('URL:', url);
console.log('HISTORY_TABS:', JSON.stringify(historyTabTexts));
console.log('TAB_TEXTS:', JSON.stringify(tabTexts));
console.log('BODY:', bodyText.substring(0, 200));
console.log('ERRORS:', JSON.stringify(errors));

await browser.close();
