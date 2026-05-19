// Hero-GIF recorder. Drives the live demo with Playwright, records the
// page via Playwright's video API, then ffmpeg converts the webm to a
// palette-optimised GIF.
//
// Run: tsx scripts/record-hero.ts
// Output: public/hero.gif

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const DEMO_URL = process.env.DEMO_URL ?? "https://venue-concierge.vercel.app";
const PROMPT =
  "Hi! 25 people on Tuesday June 16, 2026 at 7pm — what's the back room look like?";

const VIDEO_DIR = join(process.cwd(), "scripts", "video-tmp");
const OUTPUT_GIF = join(process.cwd(), "public", "hero.gif");
const VIEWPORT = { width: 1280, height: 720 };

async function record(): Promise<string> {
  if (existsSync(VIDEO_DIR)) rmSync(VIDEO_DIR, { recursive: true, force: true });
  mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
    deviceScaleFactor: 2, // crisp text in the GIF
  });
  const page = await context.newPage();

  console.log(`navigating to ${DEMO_URL}…`);
  await page.goto(DEMO_URL, { waitUntil: "networkidle" });
  // The suggested-prompt chips are the last thing to paint; wait for at
  // least one to be visible before we start typing so the GIF doesn't
  // open on a flash of empty state.
  await page.getByRole("button", { name: /back room/i }).first().waitFor();

  // Hold on the empty state for half a second so the viewer sees the
  // suggested chips before we start typing.
  await page.waitForTimeout(500);

  const composer = page.getByPlaceholder(/Message /);
  await composer.click();
  // Type at ~50ms/char — fast enough to keep the GIF under 15s, slow
  // enough that the human eye reads it as typing, not pasting.
  await composer.type(PROMPT, { delay: 50 });
  // Brief pause before pressing Enter so the full prompt is readable.
  await page.waitForTimeout(300);
  await composer.press("Enter");

  // Wait for the stream to land. The quote panel's "Estimated event total"
  // is the last item rendered when compute_quote returns — using it as the
  // "done" sentinel is more robust than a fixed timeout.
  console.log("waiting for quote to land…");
  await page
    .getByText(/Estimated event total/i)
    .waitFor({ timeout: 60_000 });

  // Hold on the final state for a beat so the viewer can read the breakdown.
  await page.waitForTimeout(1500);

  await context.close();
  await browser.close();

  const files = readdirSync(VIDEO_DIR).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) throw new Error("no video file produced");
  return join(VIDEO_DIR, files[0]);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
  });
}

async function convertToGif(webm: string) {
  // Two-pass palette generation gives noticeably better colour fidelity
  // than ffmpeg's default GIF encoder, especially on the venue-branded
  // emerald accent and the dark zinc text.
  const palette = join(VIDEO_DIR, "palette.png");
  const filters =
    "fps=15,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5";

  console.log("running ffmpeg…");
  // Single-pass version of palettegen+paletteuse via complex filter — same
  // quality as two-pass, half the I/O.
  await run("ffmpeg", [
    "-y",
    "-i",
    webm,
    "-vf",
    filters,
    "-loop",
    "0",
    OUTPUT_GIF,
  ]);

  if (existsSync(palette)) rmSync(palette);
  rmSync(VIDEO_DIR, { recursive: true, force: true });
}

async function main() {
  const webm = await record();
  console.log(`recorded: ${webm}`);
  await convertToGif(webm);
  console.log(`hero gif written to ${OUTPUT_GIF}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
