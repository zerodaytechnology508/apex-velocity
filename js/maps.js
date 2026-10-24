// Circuits and their environments. Control points are [x, elevation, z].
export const MAPS = [
  {
    id: 'valle', name: 'Valle Ridge', place: 'Alpine circuit', time: 'Afternoon',
    start: [0, -120],
    ctrl: [[0, 0, -350], [0, 1.5, 0], [0, 3, 300], [60, 5, 420], [200, 9, 455], [320, 13, 385], [365, 12, 250], [300, 8, 150], [360, 6, 40], [480, 10, -40], [525, 16, -200], [440, 20, -330], [310, 14, -370], [230, 8, -330], [150, 4, -425], [60, 1, -470]],
    theme: {
      ground: 'grass', verge: 'grass', vergeTint: 0xd8e2c8, trees: 'pine', treeCount: 2400, mountains: [1150, 2100, 360], hills: 30,
      sky: { elev: 32, azim: -140, turbidity: 2.8, rayleigh: 2.6, mie: 0.003, mieG: 0.85 },
      sun: { color: 0xfff0dd, intensity: 6.0 }, hemi: [0xcfe2ff, 0x5a6a44, 0.3], env: 0.5, exposure: 0.54,
      fog: [0xa9bccf, 0.00032], grip: 1, grandstand: true, pits: true, rock: [0.20, 0.18, 0.15], snowLine: 260,
    },
  },
  {
    id: 'mesa', name: 'Red Mesa', place: 'Desert raceway', time: 'Midday',
    start: [0, -300],
    ctrl: [[0, 0, -500], [0, 2, -100], [0, 4, 300], [40, 5, 480], [180, 6, 560], [360, 10, 520], [470, 14, 380], [430, 16, 200], [300, 14, 120], [260, 12, -20], [340, 10, -160], [520, 12, -240], [600, 14, -420], [520, 10, -600], [320, 6, -680], [140, 2, -660]],
    theme: {
      ground: 'sand', verge: 'sand', vergeTint: 0xf0dcc4, trees: 'cactus', treeCount: 900, mesas: true, mountains: [1300, 2300, 220], hills: 16,
      sky: { elev: 58, azim: 150, turbidity: 6, rayleigh: 1.4, mie: 0.004, mieG: 0.8 },
      sun: { color: 0xfff3e0, intensity: 6.6 }, hemi: [0xdfe8ff, 0x8a6a48, 0.35], env: 0.5, exposure: 0.5,
      fog: [0xd9c6ae, 0.00030], grip: 0.97, grandstand: true, pits: false, rock: [0.36, 0.17, 0.08], snowLine: 9999,
    },
  },
  {
    id: 'costa', name: 'Costa Azul', place: 'Coastal road', time: 'Sunset',
    start: [0, -100],
    ctrl: [[0, 8, -300], [0, 8, 100], [-30, 7, 300], [-140, 5, 420], [-200, 4, 560], [-120, 6, 700], [40, 9, 720], [160, 14, 600], [150, 16, 420], [240, 18, 300], [330, 16, 160], [300, 14, -20], [200, 12, -120], [220, 12, -300], [160, 10, -460], [40, 8, -470]],
    theme: {
      ground: 'grass', verge: 'sand', vergeTint: 0xf0e2c8, trees: 'palm', treeCount: 900, sea: { x: -270, level: 0 }, mountains: [1000, 1900, 260], hills: 26,
      sky: { elev: 5, azim: -105, turbidity: 4.5, rayleigh: 2.2, mie: 0.006, mieG: 0.9 },
      sun: { color: 0xffb37a, intensity: 5.2 }, hemi: [0xffd2b0, 0x4a5a4a, 0.42], env: 0.62, exposure: 0.68,
      fog: [0xd9a98c, 0.00034], grip: 1, grandstand: false, pits: true, rock: [0.25, 0.2, 0.16], snowLine: 9999,
    },
  },
  {
    id: 'frost', name: 'Frostpine Ring', place: 'Winter forest', time: 'Snowfall',
    start: [0, -60],
    ctrl: [[0, 0, -250], [0, 2, 100], [30, 4, 220], [150, 8, 260], [230, 12, 180], [200, 14, 40], [260, 16, -60], [380, 18, -40], [450, 20, 60], [520, 18, 250], [620, 14, 210], [640, 10, -60], [540, 6, -220], [400, 4, -300], [260, 2, -240], [160, 0, -330], [60, 0, -380]],
    theme: {
      ground: 'snow', verge: 'snow', vergeTint: 0xffffff, trees: 'snowpine', treeCount: 2600, mountains: [1000, 2000, 420], hills: 34, snowfall: true,
      sky: { elev: 18, azim: 160, turbidity: 9, rayleigh: 3.2, mie: 0.01, mieG: 0.7 },
      sun: { color: 0xe8eeff, intensity: 3.6 }, hemi: [0xe4ecff, 0xb8c2d0, 0.65], env: 0.62, exposure: 0.62,
      fog: [0xc9d3df, 0.0011], grip: 0.8, grandstand: true, pits: false, rock: [0.3, 0.31, 0.33], snowLine: -999, wetRoad: true,
    },
  },
  {
    id: 'neon', name: 'Neon Harbor', place: 'City street circuit', time: 'Night',
    start: [0, -100],
    ctrl: [[0, 0, -300], [0, 0, 150], [20, 0, 230], [100, 0, 250], [300, 0, 250], [380, 0, 280], [420, 0, 380], [500, 0, 420], [620, 0, 400], [660, 0, 300], [640, 0, 100], [560, 0, 40], [460, 0, 40], [400, 0, -40], [400, 0, -250], [360, 0, -330], [260, 0, -360], [80, 0, -360], [20, 0, -340]],
    theme: {
      ground: 'dirt', verge: 'dirt', vergeTint: 0x707070, trees: 'none', treeCount: 0, city: true, lamps: true, stars: true, mountains: [1500, 2400, 120], hills: 2, flat: true,
      sky: { elev: -6, azim: 20, turbidity: 2, rayleigh: 1.2, mie: 0.002, mieG: 0.8 },
      sun: { color: 0x9db8ff, intensity: 0.9, moon: true }, hemi: [0x3a4c78, 0x1a1a22, 0.8], env: 0.8, exposure: 0.9,
      fog: [0x141a2a, 0.0006], grip: 1, grandstand: true, pits: true, rock: [0.2, 0.2, 0.22], snowLine: 9999, night: true, wetRoad: true,
    },
  },
];
export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
