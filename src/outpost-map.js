// The FreeDM Outpost Conquest map as an SVG string: open floor, both teams' spawns and sectors.
// Shared by the squad lobby and the game's setup screen so both always draw the same layout.
// Colours come from CSS custom properties (--accent for Cyan, --enemy for Ember) on the page.
import { FREEDM_MAP } from "./maps/freedm-dm01.js";
import { CONQUEST_LAYOUT } from "./world.js";
// Draw the real FreeDM Outpost layout: open floor, both teams' spawn columns and sectors A-C.
export function outpostMap(id = "") {
  const { rows } = FREEDM_MAP,
    w = rows[0].length,
    h = rows.length;
  let floor = "";
  rows.forEach((row, z) => {
    for (let x = 0; x < w;) {
      if (row[x] !== ".") {
        x++;
        continue;
      }
      const start = x;
      while (x < w && row[x] === ".") x++;
      floor += `<rect x="${start}" y="${z}" width="${x - start}" height="1"/>`;
    }
  });
  const bases = CONQUEST_LAYOUT.bases
    .map(([x, spawnRows], team) =>
      spawnRows
        .map(
          (z) =>
            `<rect x="${x - 0.5}" y="${z - 0.5}" width="2" height="2" rx="0.4" fill="var(--${team ? "enemy" : "accent"})"/>`,
        )
        .join(""),
    )
    .join("");
  const sectors = CONQUEST_LAYOUT.sectors
    .map(
      ({ id, cell: [x, z] }) =>
        `<circle cx="${x + 0.5}" cy="${z + 0.5}" r="2.6" fill="#000" stroke="#fff" stroke-width="0.5"/><text x="${x + 0.5}" y="${z + 1.55}" text-anchor="middle" font-size="3" font-weight="600" fill="#fff">${id}</text>`,
    )
    .join("");
  // Name each team at its own spawn column, in its own colour, instead of in a caption.
  const teams = CONQUEST_LAYOUT.bases
    .map(
      ([x, spawnRows], team) =>
        `<text x="${x + 0.5}" y="${Math.min(...spawnRows) - 2.2}" text-anchor="middle" font-size="2.6" font-weight="600" fill="var(--${team ? "enemy" : "accent"})">${team ? "Ember" : "Cyan"}</text>`,
    )
    .join("");
  return `<svg${id ? ` id="${id}"` : ""} viewBox="-1 -1 ${w + 2} ${h + 2}" role="img" aria-label="FreeDM Outpost map: Cyan spawns on the west edge, Ember spawns on the east edge, sectors A, B and C between them"><g fill="#2a2a2a">${floor}</g>${bases}${teams}${sectors}</svg>`;
}
