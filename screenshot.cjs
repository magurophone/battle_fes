const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 60000 });

  await page.waitForSelector('#voteCountdown', { state: 'attached' });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const el = document.getElementById('voteCountdown');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'shot-full.png', fullPage: false });
  const cd = await page.$('#voteCountdown');
  if (cd) {
    await cd.screenshot({ path: 'shot-countdown.png' });
    // Capture mid-shine and breath peaks
    for (const [t, name] of [[1500, 'shot-cd-t1.png'], [2500, 'shot-cd-t2.png'], [3500, 'shot-cd-t3.png']]) {
      await page.waitForTimeout(t === 1500 ? t : 1000);
      await cd.screenshot({ path: name });
    }
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.getElementById('voteCountdown')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shot-full-mobile.png', fullPage: false });
  const cdm = await page.$('#voteCountdown');
  if (cdm) await cdm.screenshot({ path: 'shot-countdown-mobile.png' });

  await browser.close();
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
