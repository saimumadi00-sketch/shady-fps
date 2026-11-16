// Field kit for each class, shared by third- and first-person models. Uniforms are muted and
// differ by role; the team is shown separately, by tape on the arms and headgear.
import { normalizeClass } from "./loadouts.js";
const STYLES = {
  // Rifleman: ranger-green uniform, coyote plate carrier, high-cut helmet with headset.
  assault: {
    uniform: [0.3, 0.33, 0.24],
    carrier: [0.46, 0.39, 0.27],
    headgear: [0.37, 0.36, 0.27],
    gloves: [0.2, 0.2, 0.18],
    boots: [0.33, 0.27, 0.19],
    hair: [0.16, 0.12, 0.09],
    head: "helmet",
    pack: "slim",
    eyewear: true,
  },
  // Engineer: urban grey, black chest rig, ball cap and ear protection, radio pack.
  engineer: {
    uniform: [0.33, 0.35, 0.37],
    carrier: [0.13, 0.14, 0.15],
    headgear: [0.17, 0.18, 0.2],
    gloves: [0.55, 0.43, 0.24],
    boots: [0.11, 0.11, 0.12],
    hair: [0.3, 0.2, 0.12],
    head: "cap",
    pack: "radio",
    eyewear: false,
  },
  // Marksman: khaki, brown chest rig, boonie hat and a scarf over the lower face.
  recon: {
    uniform: [0.5, 0.45, 0.33],
    carrier: [0.34, 0.28, 0.2],
    headgear: [0.44, 0.4, 0.29],
    gloves: [0.3, 0.26, 0.19],
    boots: [0.4, 0.33, 0.23],
    hair: [0.12, 0.1, 0.09],
    scarf: [0.4, 0.39, 0.3],
    head: "boonie",
    pack: "none",
    eyewear: false,
  },
  // Machine gunner: olive, heavy dark carrier, full helmet, balaclava and an ammunition pack.
  support: {
    uniform: [0.27, 0.3, 0.2],
    carrier: [0.19, 0.22, 0.16],
    headgear: [0.22, 0.25, 0.18],
    gloves: [0.13, 0.13, 0.12],
    boots: [0.14, 0.13, 0.11],
    hair: [0.1, 0.1, 0.1],
    scarf: [0.1, 0.11, 0.1],
    head: "helmet",
    pack: "heavy",
    eyewear: true,
  },
};
// `cloth` and `accent` are the names the first-person hands read.
for (const s of Object.values(STYLES)) {
  s.cloth = s.uniform;
  s.accent = s.carrier;
  s.iris = [0.2, 0.16, 0.12];
}
export function characterStyle(classId, id = 0) {
  return STYLES[normalizeClass(classId)] || Object.values(STYLES)[id % 4];
}
