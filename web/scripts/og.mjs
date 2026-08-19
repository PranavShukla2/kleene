/**
 * Generate the link-preview image and the apple-touch icon.
 *
 * Rendered in a real browser rather than drawn by hand, and using the real font files and the
 * real palette tokens, so the card cannot slowly stop looking like the site it is advertising.
 * Run it with `npm run og` after any change to the palette or the type.
 *
 * The temporary page is written beside `node_modules` on purpose: `@font-face` sources are
 * resolved relative to the document, and the fonts live there.
 */
import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..');
const scratch = resolve(web, '.og-tmp.html');

/** The palette, light theme, copied from styles.css. Kept short — this is a poster, not a UI. */
const CARD = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./node_modules/@fontsource-variable/bricolage-grotesque/wght.css" />
    <link rel="stylesheet" href="./node_modules/@fontsource-variable/plus-jakarta-sans/wght.css" />
    <link rel="stylesheet" href="./node_modules/@fontsource/jetbrains-mono/latin-400.css" />
    <link rel="stylesheet" href="./node_modules/@fontsource/jetbrains-mono/greek-400.css" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1200px; height: 630px;
        background: #ffffff;
        font-family: 'Plus Jakarta Sans Variable', sans-serif;
        color: #0f172a;
        position: relative;
        overflow: hidden;
      }
      .aurora {
        position: absolute; inset: -10%;
        background:
          radial-gradient(38rem 26rem at 14% 4%, rgba(109,94,248,.40), transparent 68%),
          radial-gradient(34rem 24rem at 88% 0%, rgba(8,145,178,.32), transparent 68%),
          radial-gradient(30rem 26rem at 66% 78%, rgba(217,70,239,.26), transparent 70%);
        filter: blur(14px);
      }
      .grid {
        position: absolute; inset: 0;
        background-image: radial-gradient(#e2e8f0 1.4px, transparent 1.4px);
        background-size: 34px 34px;
        -webkit-mask-image: linear-gradient(to bottom, #000, transparent 88%);
      }
      .inner { position: relative; padding: 74px 78px; height: 100%; display: flex; flex-direction: column; }
      .mark { font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 500;
              background: linear-gradient(100deg,#6d5ef8,#d946ef 42%,#0891b2);
              -webkit-background-clip: text; background-clip: text; color: transparent; }
      .kicker { font-family: 'JetBrains Mono', monospace; font-size: 17px; color: #64748b; margin-left: 16px; }
      h1 { font-family: 'Bricolage Grotesque Variable', sans-serif; font-weight: 600;
           font-size: 84px; line-height: 1.02; letter-spacing: -0.032em; margin-top: auto; max-width: 15ch; }
      .accent { background: linear-gradient(100deg,#6d5ef8,#d946ef 46%,#0891b2);
                -webkit-background-clip: text; background-clip: text; color: transparent; }
      p { font-size: 25px; color: #475569; margin-top: 26px; max-width: 34ch; line-height: 1.42; }
      .foot { margin-top: auto; padding-top: 34px; display: flex; gap: 26px;
              font-family: 'JetBrains Mono', monospace; font-size: 17px; color: #64748b; }
      .pipe { position: absolute; right: 78px; bottom: 74px; text-align: right;
              font-family: 'JetBrains Mono', monospace; font-size: 19px; color: #475569; line-height: 2.1; }
      .pipe b { color: #6d5ef8; font-weight: 400; }
    </style>
  </head>
  <body>
    <div class="aurora"></div>
    <div class="grid"></div>
    <div class="inner">
      <div style="display:flex;align-items:baseline">
        <span class="mark">kleene</span><span class="kicker">automata workbench</span>
      </div>
      <h1>Automata theory you can <span class="accent">watch happen</span>.</h1>
      <p>Every conversion shows its working — not just its answer.</p>
      <div class="foot">
        <span>free, forever</span><span>·</span><span>no account</span>
        <span>·</span><span>nothing uploaded</span>
      </div>
      <div class="pipe">
        regex<br />↓ <b>Thompson</b><br />ε-NFA<br />↓ <b>subset</b><br />DFA<br />↓ <b>minimize</b><br />minimal DFA
      </div>
    </div>
  </body>
</html>`;

const browser = await chromium.launch();

try {
  await writeFile(scratch, CARD, 'utf8');
  await mkdir(resolve(web, 'public'), { recursive: true });

  const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await card.goto(`file://${scratch}`);
  // Fonts are the whole point of rendering rather than drawing; do not shoot before they land.
  await card.evaluate(() => document.fonts.ready);
  await card.screenshot({ path: resolve(web, 'public/og.png') });
  console.log('wrote public/og.png');

  // Apple wants a raster icon and will not take the SVG. 180×180 is the largest it asks for,
  // and everything smaller is downscaled from it.
  //
  // Wrapped in an HTML page rather than opened directly: an SVG loads as its own document
  // type, with no `<body>` to paint a background onto — and a transparent touch icon renders
  // black behind a home-screen label.
  await writeFile(
    scratch,
    `<!doctype html><html><body style="margin:0;background:#0f1117;width:180px;height:180px;
     display:flex;align-items:center;justify-content:center">
     <img src="./public/favicon.svg" width="132" height="132" alt="" /></body></html>`,
    'utf8',
  );
  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.goto(`file://${scratch}`);
  await icon.evaluate(() => document.fonts.ready);
  await icon.screenshot({ path: resolve(web, 'public/apple-touch-icon.png') });
  console.log('wrote public/apple-touch-icon.png');
} finally {
  await browser.close();
  await rm(scratch, { force: true });
}
