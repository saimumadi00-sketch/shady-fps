// Shared class definitions keep menu choices, bot assignments, and combat permissions aligned.
// Every class carries exactly two weapons: slot 1 is a primary and slot 2 the shared pistol.
// `primaries` lists the primaries a class may choose from (modern and WW2); `primary` is its
// default, and `weapons` the default pair. An actor's own choice lives in `actor.primary`.
export const LOADOUTS = Object.freeze({
  assault: Object.freeze({
    name: "Assault",
    primary: 0,
    primaries: Object.freeze([0, 5, 6, 7]),
    weapons: Object.freeze([0, 2]),
    description:
      "Versatile medium-range fighting with a full-size assault rifle.",
  }),
  support: Object.freeze({
    name: "Support",
    primary: 4,
    primaries: Object.freeze([4, 13, 14]),
    weapons: Object.freeze([4, 2]),
    description:
      "Holds lanes with a 100-round LMG; slow to reload and reposition.",
  }),
  engineer: Object.freeze({
    name: "Engineer",
    primary: 1,
    primaries: Object.freeze([1, 8, 9, 10]),
    weapons: Object.freeze([1, 2]),
    description: "Fast handling and accurate moving fire with a compact SMG.",
  }),
  recon: Object.freeze({
    name: "Recon",
    primary: 3,
    primaries: Object.freeze([3, 11, 12]),
    weapons: Object.freeze([3, 2]),
    description:
      "Precise long-range shots and headshots with a marksman rifle.",
  }),
});
export const CLASS_IDS = Object.freeze(Object.keys(LOADOUTS));
// Saves and links created before the Recon rename still use the old class ID.
const ALIASES = Object.freeze({ scout: "recon" });
export const normalizeClass = (id) =>
  Object.prototype.hasOwnProperty.call(ALIASES, id) ? ALIASES[id] : id;
// Invalid saved class IDs fall back to the default frontline loadout.
export function loadout(id) {
  id = normalizeClass(id);
  return Object.prototype.hasOwnProperty.call(LOADOUTS, id)
    ? LOADOUTS[id]
    : LOADOUTS.assault;
}
export const SIDEARM = 2;
// The loadout an actor actually carries: their chosen primary when their class offers it,
// otherwise the class default, plus the sidearm.
export function kitOf(actor) {
  const kit = loadout(actor.classId),
    primary = kit.primaries.includes(actor.primary)
      ? actor.primary
      : kit.primary;
  return primary === kit.primary
    ? kit
    : { ...kit, primary, weapons: [primary, SIDEARM] };
}
// The class that may carry a primary; the pistol and unknown IDs map to the default class.
export function classForWeapon(index) {
  return (
    CLASS_IDS.find((id) => LOADOUTS[id].primaries.includes(index)) || "assault"
  );
}
// Combat checks use the actor's own kit, not the currently displayed menu options.
export function canEquip(actor, index) {
  return Number.isInteger(index) && kitOf(actor).weapons.includes(index);
}
// Translate a 1-based inventory slot key into the actor's global weapon index.
export function slotWeapon(actor, slot) {
  return kitOf(actor).weapons[slot - 1];
}
