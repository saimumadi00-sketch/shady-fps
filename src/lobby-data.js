// Lobby balance profiles are deliberately class-specific; training uses existing weapon equivalents.
export const classes = {
  assault: {
    name: "ASSAULT",
    role: "Versatile rifleman",
    color: 0x78939f,
    weapons: [
      {
        name: "AR-41 Vanguard",
        category: "ASSAULT RIFLE",
        model: 0,
        description: "Balanced / 30 rounds / 720 RPM",
        stats: [65, 64, 72, 70],
      },
      {
        name: "AR-18 Sentinel",
        category: "ASSAULT RIFLE",
        model: 0,
        description: "Controlled / 30 rounds / 620 RPM",
        stats: [69, 72, 80, 62],
      },
    ],
  },
  engineer: {
    name: "ENGINEER",
    role: "Mobile close-range fighter",
    color: 0xad8456,
    weapons: [
      {
        name: "VX-9 Wraith",
        category: "SUBMACHINE GUN",
        model: 1,
        description: "Agile / 32 rounds / 900 RPM",
        stats: [44, 32, 65, 95],
      },
      {
        name: "C-12 Nomad",
        category: "COMPACT CARBINE",
        model: 0,
        description: "Compact / 24 rounds / 780 RPM",
        stats: [56, 48, 62, 85],
      },
    ],
  },
  support: {
    name: "SUPPORT",
    role: "Sustained-fire gunner",
    color: 0x788775,
    weapons: [
      {
        name: "MG-60 Atlas",
        category: "LIGHT MACHINE GUN",
        model: 4,
        description: "Sustained / 100 rounds / 650 RPM",
        stats: [70, 70, 80, 30],
      },
      {
        name: "MG-36 Bastion",
        category: "LIGHT MACHINE GUN",
        model: 4,
        description: "Lane control / 75 rounds / 720 RPM",
        stats: [64, 65, 74, 40],
      },
    ],
  },
  recon: {
    name: "RECON",
    role: "Precision marksman",
    color: 0x697e92,
    weapons: [
      {
        name: "SR-7 Longbow",
        category: "SNIPER RIFLE",
        model: 3,
        description: "Precision / 5 rounds / 48 RPM",
        stats: [98, 98, 52, 23],
      },
      {
        name: "DMR-14 Spectre",
        category: "MARKSMAN RIFLE",
        model: 3,
        description: "Semi-auto / 15 rounds / 280 RPM",
        stats: [78, 86, 68, 45],
      },
    ],
  },
};
export const modes = {
  Conquest:
    "Playable offline: capture A, B and C on FreeDM Outpost. Hold more sectors to drain enemy tickets.",
  Domination: "Close quarters. Three objectives. No retreat.",
  "Team Deathmatch": "Squad against squad. Every elimination counts.",
};
