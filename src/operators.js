// Operator dossiers for the operator select: the four classes under the squad codenames the
// lobby uses (NOVA, HEX, ROOK, GHOST), and weapon ratings derived from the real weapon data.
import { LOADOUTS } from "./loadouts.js";
import { WEAPONS } from "./weapons.js";

export const OPERATORS = Object.freeze({
  assault: { codename: "NOVA", role: "Assault · rifleman", key: "1" },
  engineer: { codename: "HEX", role: "Engineer · close quarters", key: "2" },
  support: { codename: "ROOK", role: "Support · lane control", key: "3" },
  recon: { codename: "GHOST", role: "Recon · marksman", key: "4" },
});
export const OPERATOR_ORDER = Object.freeze(["assault", "engineer", "support", "recon"]);

// Each rating is the weapon's value against the best weapon in the arsenal, 0-1.
const RATINGS = [
  ["Damage", (w) => w.damage[0]],
  ["Fire rate", (w) => w.rpm],
  ["Range", (w) => w.falloff[1]],
  ["Handling", (w) => 1 / w.adsTime],
  ["Mobility", (w) => 1 / w.weight],
];
export function weaponRatings(index) {
  const w = WEAPONS[index];
  return RATINGS.map(([label, of]) => {
    const best = Math.max(...WEAPONS.map(of));
    return { label, value: of(w) / best };
  });
}
export const primaryOf = (classId) => WEAPONS[LOADOUTS[classId].primary];
