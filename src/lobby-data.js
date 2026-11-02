// Lobby weapon cards. The first entry per class is the playable weapon and mirrors src/weapons.js;
// the second is a preview variant that deploys with the class's playable primary.
export const classes = {
  assault: {
    name: "Assault",
    role: "Versatile rifleman",
    color: 0x78939f,
    weapons: [
      {
        name: "AR-41 Vanguard",
        category: "Assault rifle",
        model: 0,
        description: "Balanced · 30 rounds · 650 RPM",
        stats: [65, 64, 72, 70],
      },
      {
        name: "AR-18 Sentinel",
        category: "Assault rifle",
        model: 0,
        description: "Controlled · 30 rounds · 620 RPM",
        stats: [69, 72, 80, 62],
      },
    ],
  },
  engineer: {
    name: "Engineer",
    role: "Mobile close-range fighter",
    color: 0xad8456,
    weapons: [
      {
        name: "VX-9 Wraith",
        category: "Submachine gun",
        model: 1,
        description: "Agile · 28 rounds · 850 RPM",
        stats: [44, 32, 65, 95],
      },
      {
        name: "C-12 Nomad",
        category: "Compact carbine",
        model: 0,
        description: "Compact · 24 rounds · 780 RPM",
        stats: [56, 48, 62, 85],
      },
    ],
  },
  support: {
    name: "Support",
    role: "Sustained-fire gunner",
    color: 0x788775,
    weapons: [
      {
        name: "MG-60 Atlas",
        category: "Light machine gun",
        model: 4,
        description: "Sustained · 100 rounds · 700 RPM",
        stats: [70, 70, 80, 30],
      },
      {
        name: "MG-36 Bastion",
        category: "Light machine gun",
        model: 4,
        description: "Lane control · 75 rounds · 720 RPM",
        stats: [64, 65, 74, 40],
      },
    ],
  },
  recon: {
    name: "Recon",
    role: "Precision marksman",
    color: 0x697e92,
    weapons: [
      {
        name: "DMR-14 Spectre",
        category: "Marksman rifle",
        model: 3,
        description: "Semi-auto · 16 rounds · 260 RPM",
        stats: [78, 86, 68, 45],
      },
      {
        name: "SR-7 Longbow",
        category: "Sniper rifle",
        model: 3,
        description: "Preview · 5 rounds · 50 RPM",
        stats: [98, 98, 52, 23],
      },
    ],
  },
};
export const modes = {
  Conquest: "Offline 5v5. Hold more of A, B and C to drain Ember's tickets.",
  Domination: "A preview for now: it deploys as offline Team Deathmatch.",
  "Team Deathmatch": "Yard 07, offline 5v5. First team to 30 wins.",
};
