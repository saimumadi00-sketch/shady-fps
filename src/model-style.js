// Original anime-inspired squad designs shared by third- and first-person models.
const STYLES = {
  assault: {
    hair: [0.23, 0.2, 0.36],
    iris: [0.65, 0.42, 0.95],
    accent: [0.75, 0.64, 0.95],
    cloth: [0.19, 0.18, 0.28],
    cut: "spikes",
  },
  engineer: {
    hair: [0.92, 0.59, 0.28],
    iris: [0.21, 0.72, 0.77],
    accent: [1.0, 0.77, 0.38],
    cloth: [0.24, 0.23, 0.26],
    cut: "bob",
  },
  scout: {
    hair: [0.72, 0.81, 0.91],
    iris: [0.28, 0.49, 0.94],
    accent: [0.6, 0.79, 1.0],
    cloth: [0.17, 0.23, 0.32],
    cut: "tail",
  },
  support: {
    hair: [0.34, 0.62, 0.51],
    iris: [0.91, 0.62, 0.32],
    accent: [0.66, 0.92, 0.72],
    cloth: [0.18, 0.28, 0.23],
    cut: "bob",
  },
};
export function characterStyle(classId, id = 0) {
  return (
    STYLES[classId === "recon" ? "scout" : classId] ||
    Object.values(STYLES)[id % 4]
  );
}
