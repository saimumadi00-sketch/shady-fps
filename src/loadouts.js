// Shared class definitions keep menu choices, bot assignments, and combat permissions aligned.
// Every class carries exactly two weapons: slot 1 is the class primary, slot 2 the shared pistol.
export const LOADOUTS = Object.freeze({
  assault: Object.freeze({
    name: "Assault",
    primary: 0,
    weapons: Object.freeze([0, 2]),
    description:
      "Versatile medium-range fighting with a full-size assault rifle.",
  }),
  support: Object.freeze({
    name: "Support",
    primary: 4,
    weapons: Object.freeze([4, 2]),
    description:
      "Holds lanes with a 100-round LMG; slow to reload and reposition.",
  }),
  engineer: Object.freeze({
    name: "Engineer",
    primary: 1,
    weapons: Object.freeze([1, 2]),
    description: "Fast handling and accurate moving fire with a compact SMG.",
  }),
  recon: Object.freeze({
    name: "Recon",
    primary: 3,
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
// Preserve old starting-weapon saves by assigning the class that owns that primary.
export function classForWeapon(index) {
  return CLASS_IDS.find((id) => LOADOUTS[id].primary === index) || "assault";
}
// Combat checks use the actor class, not the currently displayed menu options.
export function canEquip(actor, index) {
  return (
    Number.isInteger(index) && loadout(actor.classId).weapons.includes(index)
  );
}
// Translate a 1-based inventory slot key into the class's global weapon index.
export function slotWeapon(classId, slot) {
  return loadout(classId).weapons[slot - 1];
}
