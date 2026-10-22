/**
 * Downloads the stock photographs listed in lib/images.ts into /public/images.
 *
 * Run once after cloning:   npm run fetch-images
 *
 * Images are NOT committed to Supabase Storage — they live in /public and are
 * served statically, which keeps the Supabase storage quota entirely free for
 * employee documents later.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "images");
const WIDTH = 1600;

// Parse the slug/id pairs straight out of lib/images.ts so there is only one
// list to maintain.
const source = readFileSync(path.join(root, "lib", "images.ts"), "utf8");
const entries = [...source.matchAll(/slug:\s*"([^"]+)",\s*id:\s*"(\d+)"/g)].map(
  ([, slug, id]) => ({ slug, id }),
);

if (entries.length === 0) {
  console.error("No images found in lib/images.ts — aborting.");
  process.exit(1);
}

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

await mkdir(outDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
const failures = [];

for (const { slug, id } of entries) {
  const dest = path.join(outDir, `${slug}.jpg`);

  if (await exists(dest)) {
    skipped++;
    continue;
  }

  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${WIDTH}`;

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 5_000) throw new Error("suspiciously small response");

    await writeFile(dest, buf);
    downloaded++;
    console.log(`  ✓ ${slug}.jpg  (${Math.round(buf.byteLength / 1024)} KB)`);
  } catch (err) {
    failures.push({ slug, id, reason: err.message });
    console.error(`  ✗ ${slug} (id ${id}) — ${err.message}`);
  }
}

console.log(
  `\nDone. ${downloaded} downloaded, ${skipped} already present, ${failures.length} failed.`,
);

// Fail loudly rather than shipping a page with broken images.
if (failures.length > 0) {
  console.error(
    "\nThese images could not be fetched. Replace the ids in lib/images.ts:",
  );
  for (const f of failures) console.error(`  - ${f.slug} (${f.id}): ${f.reason}`);
  process.exit(1);
}
