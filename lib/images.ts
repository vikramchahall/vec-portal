/**
 * Stock photography manifest.
 *
 * Every URL here was verified to return HTTP 200. Source: Pexels — free for
 * commercial use, no attribution required.
 *
 * IMPORTANT: these are generic industry photographs, NOT photographs of Vikram
 * Engineering Co. sites. They are rendered with a "Representative image" marker
 * and must never be captioned as a VEC project. Replace them with real site
 * photographs as soon as those exist — swap the `local` path and set
 * `isStock: false`, nothing else changes.
 *
 * Run `npm run fetch-images` to download them into /public/images.
 */

export type StockImage = {
  slug: string;
  id: string;
  alt: string;
  isStock: boolean;
};

export const IMAGE_BASE = "https://images.pexels.com/photos";

export const images: StockImage[] = [
  { slug: "hero-refinery-night", id: "10407689", alt: "Oil refinery lit up at night", isStock: true },
  { slug: "refinery-day", id: "15970032", alt: "Refinery plant with pipework", isStock: true },
  { slug: "etp-aerial", id: "19517566", alt: "Effluent treatment plant", isStock: true },
  { slug: "stp-aerial-1", id: "19281034", alt: "Sewage treatment plant from above", isStock: true },
  { slug: "stp-aerial-2", id: "5712211", alt: "Aerial view of a sewage treatment plant", isStock: true },
  { slug: "wtp-aerial-3", id: "3808769", alt: "Aerial view of a water treatment plant", isStock: true },
  { slug: "wtp-aerial-4", id: "5131196", alt: "Water treatment plant from above", isStock: true },
  { slug: "workers-safety-gear", id: "32845683", alt: "Industrial workers in safety gear at a plant", isStock: true },
  { slug: "workers-hardhats", id: "4956920", alt: "Group of workers wearing hard hats", isStock: true },
  { slug: "engineer-inspecting", id: "2760241", alt: "Engineer in hi-vis vest inspecting machinery", isStock: true },
  { slug: "welding-sparks", id: "29976478", alt: "Industrial welding with sparks", isStock: true },
  { slug: "welder-at-work", id: "15888226", alt: "Welder at work in protective gear", isStock: true },
  { slug: "welding-metal", id: "2760343", alt: "Person welding metal", isStock: true },
  { slug: "trench-worker", id: "15099463", alt: "Worker in a trench at a construction site", isStock: true },
  { slug: "spray-painting", id: "6870314", alt: "Worker using a paint spray gun", isStock: true },
  { slug: "pipes-valves", id: "29248902", alt: "Industrial pipes with coloured valves", isStock: true },
  { slug: "valve-large-pipe", id: "13726337", alt: "Valve on a large pipe", isStock: true },
  { slug: "gas-pipeline", id: "3229014", alt: "Industrial pipeline at a plant", isStock: true },
  { slug: "control-room", id: "33706880", alt: "Industrial electrical control room interior", isStock: true },
  { slug: "operator-panel", id: "35072831", alt: "Worker operating a machinery control panel", isStock: true },
  { slug: "smelter-molten", id: "6804260", alt: "Molten metal in a foundry ladle", isStock: true },
  { slug: "transport-buses", id: "18029643", alt: "Buses parked in a lot", isStock: true },
  { slug: "water-channel", id: "14108476", alt: "Concrete structure beside flowing water", isStock: true },
];

const bySlug = new Map(images.map((i) => [i.slug, i]));

export function img(slug: string) {
  const found = bySlug.get(slug);
  if (!found) {
    throw new Error(
      `Unknown image slug "${slug}". Add it to lib/images.ts or fix the reference.`,
    );
  }
  return found;
}

/** Local path once `npm run fetch-images` has run. */
export function imgSrc(slug: string) {
  return `/images/${slug}.jpg`;
}

/** Remote fallback, used only before the fetch script has been run. */
export function imgRemote(slug: string, width = 1600) {
  const { id } = img(slug);
  return `${IMAGE_BASE}/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}
