# BATTLE FES 2026 Workflow

This file is the startup handover for future sessions.

## First Checks

1. Read `CLAUDE.md`, `PROJECT_STATUS.md`, and `PROGRESS.md`.
2. Check current changes with `git status --short`.
3. Do not revert unrelated local changes.

## Materials-Only Team Link Update

When the user says something like "do not add to the special site yet, add it to the team links in the explanation materials", update only the team clip link pages.

### Files To Edit

- CRIMSON: `public/clip/fgars/index.html`
- NOVA: `public/clip/b95ta/index.html`
- GOLDEN: `public/clip/8yegy/index.html`
- Member images: `public/assets/members/`

### Files Not To Edit Unless Explicitly Asked

- `public/index.html`
- `battlefes.html`
- `functions/api/_lib/vote-categories.js`

Those files are for the public special site and voting candidates. Leave them unchanged unless the user says the member is ready for public listing or voting.

### ColorSing Profile Handling

Use this when Windows curl fails on certificate revocation:

```powershell
curl.exe --ssl-no-revoke -L "<ColorSing share URL>"
```

Confirm the display name and profile image URL from OGP / `__NEXT_DATA__`. For card labels, use the short performer name rather than the full status text. Example: `なぽる ワンフレ入賞感謝🥉` becomes `なぽる`.

Download profile images into `public/assets/members/`:

```powershell
curl.exe --ssl-no-revoke -L "<profile image URL>" -o public\assets\members\<team-name>.jpg
```

### Card Pattern

Replace a pending card with:

```html
<a class="member-link" href="<ColorSing URL>" target="_blank" rel="noopener noreferrer" aria-label="<name>のColorSingプロフィールを開く">
  <span class="avatar">
    <img src="/assets/members/<image>.jpg" alt="<name>">
  </span>
  <span class="member-role">MEMBER</span>
  <span class="member-name"><name></span>
  <span class="member-action">OPEN</span>
</a>
```

Leave any still-unknown slots as `COMING SOON`.

## Local Verification

All frontend/UI changes must be verified with Playwright. Run the repeatable suite before reporting completion:

```powershell
npm run test:ui
```

For regressions and time/state-dependent UI, add the boundary states to `scripts/local-frontend-smoke.mjs` so the same bug cannot silently return. The production deploy script runs this suite as a mandatory preflight and stops when it fails.

Start static preview:

```powershell
node scripts/serve-preview.mjs
```

Check the target page and image:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8788/clip/b95ta/index.html
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8788/assets/members/<image>.jpg
```

If using Playwright and bundled browsers are missing, launch with local Edge:

```js
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});
```

## Production Deploy

Production site:

- URL: `https://battle-fes.pages.dev`
- Cloudflare Pages project: `battle-fes`
- Production branch: `master`
- Output directory: `public`

Deploy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-safe.ps1
```

Equivalent command:

```powershell
npx wrangler pages deploy public --project-name battle-fes --branch master --commit-dirty=true --commit-message "deploy"
```

Post-deploy checks:

```powershell
npx wrangler pages deployment list --project-name battle-fes
curl.exe --ssl-no-revoke -I https://battle-fes.pages.dev/clip/b95ta/
curl.exe --ssl-no-revoke -I https://battle-fes.pages.dev/assets/members/<image>.jpg
curl.exe --ssl-no-revoke -L https://battle-fes.pages.dev/clip/b95ta/
```

Confirm the latest deployment is `Production / master`, then confirm the deployed HTML includes the added name and ColorSing URL.

## Last Completed Materials-Only Update

- Date: 2026-06-12 JST
- Team: NOVA
- Page: `public/clip/b95ta/index.html`
- Added: `犬飼音子(ねこ)`
- ColorSing URL: `https://web.colorsing.com/share/user?user_id=ddba533b-8d21-4733-8cda-6764a6148fec`
- Image: `public/assets/members/nova-neko.jpg`
- Deployment status: not deployed in this update.
