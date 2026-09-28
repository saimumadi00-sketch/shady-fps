// Shared class definitions keep menu choices, bot assignments, and combat permissions aligned.
export const LOADOUTS = Object.freeze({
  assault: Object.freeze({
    name: "Assault",
    primary: 0,
    weapons: Object.freeze([0, 2]),
    description: "Frontline combat with a balanced assault rifle.",
  }),
  support: Object.freeze({
    name: "Support",
    primary: 4,
    weapons: Object.freeze([4, 2]),
    description: "Sustained covering fire with a large-magazine LMG.",
  }),
  engineer: Object.freeze({
    name: "Engineer",
    primary: 1,
    weapons: Object.freeze([1, 2]),
    description: "Close-range fighting with a compact, fast-firing SMG.",
  }),
  scout: Object.freeze({
    name: "Scout",
    primary: 3,
    weapons: Object.freeze([3, 2]),
    description: "Long-range precision with a semi-automatic marksman rifle.",
  }),
});
export const CLASS_IDS = Object.freeze(Object.keys(LOADOUTS));
// Invalid or legacy saved class IDs fall back to the default frontline loadout.
export function loadout(id) {
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
