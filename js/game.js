(() => {
  "use strict";

  const SAVE_KEY = "mistfire-sanctum-v2";
  const WORLD = 180;
  const SEG = 80;
  const WATER = 1.45;
  const GRID = 2;
  const TAU = Math.PI * 2;

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sat = (t) => clamp(t, 0, 1);
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const dist2 = (ax, az, bx, bz) => {
    const dx = ax - bx, dz = az - bz;
    return dx * dx + dz * dz;
  };
  const len2 = (x, z) => Math.hypot(x, z);
  const now = () => performance.now() / 1000;

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, z, s) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ s;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z, s) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = x - x0, fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = hash2(x0, z0, s), b = hash2(x0 + 1, z0, s);
    const c = hash2(x0, z0 + 1, s), d = hash2(x0 + 1, z0 + 1, s);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
  }
  function fbm(x, z, s, oct = 5) {
    let v = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
      v += a * vnoise(x * f, z * f, s + i * 19);
      n += a;
      a *= 0.5;
      f *= 2.03;
    }
    return v / n;
  }

  const PIECES = [
    { id: "workshop", name: "工坊", wood: 8, stone: 4, y: 0.55, solid: true, station: "craft", desc: "打造全部配方" },
    { id: "firetower", name: "火塔", wood: 6, stone: 6, crystal: 1, y: 1.3, solid: true, ward: 13, desc: "驱散腐化，烧伤靠近的敌人" },
    { id: "watchtower", name: "哨塔", wood: 10, stone: 6, y: 1.7, solid: true, turret: { dmg: 9, cd: 1.6, range: 15 }, desc: "自动射击来犯之敌" },
    { id: "golemworks", name: "傀儡台", wood: 10, stone: 8, crystal: 2, y: 0.7, solid: true, station: "golem", desc: "召唤与修复傀儡" },
    { id: "lifealtar", name: "复生坛", stone: 12, fiber: 6, crystal: 3, y: 0.5, solid: true, station: "life", desc: "以核心复活造物，保留等级" },
    { id: "farm", name: "粮圃", wood: 4, fiber: 6, y: 0.08, produce: { id: "ration", every: 66 }, desc: "定期产出干粮" },
    { id: "herbary", name: "药圃", wood: 4, fiber: 8, y: 0.08, produce: { id: "bandage", every: 78 }, desc: "定期产出绷带" },
    { id: "chest", name: "箱匣", wood: 6, y: 0.4, solid: true, desc: "堆放材料（暂为装饰）" },
    { id: "fence", name: "栅栏", wood: 2, y: 0.6, solid: true, fence: true, desc: "围墙，阻挡来犯" },
    { id: "gate", name: "栅门", wood: 3, y: 0.6, desc: "可通行的缺口" },
    { id: "spike", name: "拒马", wood: 2, stone: 2, y: 0.55, spike: true, desc: "持续伤害踩上来的敌人" },
    { id: "floor", name: "石台", stone: 3, y: 0.12, desc: "铺地" }
  ];

  const RUNES = {
    power: {
      id: "power", name: "力量符文", short: "力", color: 0xff5a3a,
      xp: ["kill"],
      desc: "大幅提升伤害与速度，击杀可掠夺魔力。最直接的杀法。",
      abil: [
        { name: "裂击", short: "裂", cd: 4.5, mana: 8, lv: 1 },
        { name: "疾驰", short: "驰", cd: 5, mana: 6, lv: 2 },
        { name: "掠魔", short: "掠", cd: 9, mana: 0, lv: 4 },
        { name: "崩地", short: "崩", cd: 16, mana: 26, lv: 6 }
      ]
    },
    golem: {
      id: "golem", name: "机械傀儡符文", short: "傀", color: 0x9aa4b0,
      xp: ["work", "kill"],
      desc: "召唤傀儡代你采集、生产与作战。前期开荒最舒适。",
      abil: [
        { name: "唤傀", short: "唤", cd: 5, mana: 22, lv: 1 },
        { name: "铁令", short: "令", cd: 14, mana: 14, lv: 2 },
        { name: "战傀", short: "战", cd: 12, mana: 34, lv: 4 },
        { name: "集结", short: "结", cd: 20, mana: 18, lv: 6 }
      ]
    },
    precision: {
      id: "precision", name: "精密符文", short: "精", color: 0x7fd7ff,
      xp: ["craft", "build"],
      desc: "加速研究与建造，降低耗材。可布下符阵炮台。",
      abil: [
        { name: "测算", short: "测", cd: 8, mana: 12, lv: 1 },
        { name: "速筑", short: "筑", cd: 20, mana: 16, lv: 2 },
        { name: "符炮", short: "炮", cd: 14, mana: 24, lv: 4 },
        { name: "超载", short: "载", cd: 25, mana: 30, lv: 6 }
      ]
    },
    life: {
      id: "life", name: "生命符文", short: "生", color: 0x7ade8a,
      xp: ["heal", "kill"],
      desc: "召唤生命造物：躯壳死了核心还在，复活保留等级。生命网络越广越难杀。",
      abil: [
        { name: "唤生", short: "生", cd: 5, mana: 26, lv: 1 },
        { name: "疗愈", short: "疗", cd: 10, mana: 18, lv: 2 },
        { name: "网络", short: "网", cd: 18, mana: 22, lv: 4 },
        { name: "群生", short: "群", cd: 24, mana: 40, lv: 6 }
      ]
    }
  };

  const ITEMS = {
    wood: { name: "木材", short: "木", kind: "mat", stack: 99, desc: "厅堂与工具的骨架。" },
    stone: { name: "石料", short: "石", kind: "mat", stack: 99, desc: "砌墙、锻镐。" },
    fiber: { name: "纤维", short: "纤", kind: "mat", stack: 99, desc: "布帛、绷带、防具。" },
    crystal: { name: "余烬晶", short: "晶", kind: "mat", stack: 99, desc: "迷雾中凝结的火种。" },
    essence: { name: "魂", short: "魂", kind: "mat", stack: 99, desc: "亡物留下的灵气。" },
    embercore: { name: "余烬核心", short: "核", kind: "key", stack: 9, desc: "雾狱守卫的心脏，用以圆满神殿之火。" },
    axe: { name: "手斧", short: "斧", kind: "tool", stack: 1, desc: "劈开树木。", tool: { family: "axe", atk: "劈", gather: ["tree"], cd: 0.42, reach: 2.55, dmg: 12, hint: "树木" } },
    axe2: { name: "精铁斧", short: "铁斧", kind: "tool", stack: 1, desc: "更快更利的伐木斧。", tool: { family: "axe", atk: "劈", gather: ["tree"], cd: 0.36, reach: 2.7, dmg: 16, hint: "树木" } },
    axe3: { name: "神殿斧", short: "神斧", kind: "tool", stack: 1, desc: "铭刻余烬符文的战斧。", tool: { family: "axe", atk: "劈", gather: ["tree"], cd: 0.32, reach: 2.85, dmg: 22, hint: "树木" } },
    pick: { name: "矿镐", short: "镐", kind: "tool", stack: 1, desc: "凿石、取晶。", tool: { family: "pick", atk: "凿", gather: ["rock", "crystal"], cd: 0.5, reach: 2.4, dmg: 10, hint: "矿石" } },
    pick2: { name: "精铁镐", short: "铁镐", kind: "tool", stack: 1, desc: "深层矿脉也吃得消。", tool: { family: "pick", atk: "凿", gather: ["rock", "crystal"], cd: 0.42, reach: 2.55, dmg: 14, hint: "矿石" } },
    pick3: { name: "神殿镐", short: "神镐", kind: "tool", stack: 1, desc: "余烬晶会自己裂开。", tool: { family: "pick", atk: "凿", gather: ["rock", "crystal"], cd: 0.36, reach: 2.7, dmg: 18, hint: "矿石" } },
    sickle: { name: "镰刀", short: "镰", kind: "tool", stack: 1, desc: "收割草丛纤维。", tool: { family: "sickle", atk: "割", gather: ["bush"], cd: 0.36, reach: 2.25, dmg: 8, hint: "纤维" } },
    sickle2: { name: "精铁镰", short: "铁镰", kind: "tool", stack: 1, desc: "一挥两丛。", tool: { family: "sickle", atk: "割", gather: ["bush"], cd: 0.28, reach: 2.4, dmg: 11, hint: "纤维" } },
    staff: { name: "余烬杖", short: "杖", kind: "tool", stack: 1, desc: "射出余烬弹。", tool: { family: "staff", atk: "咒", gather: [], cd: 0.34, reach: 0, dmg: 0, hint: "", tier: 1 } },
    staff2: { name: "余烬法杖", short: "法杖", kind: "tool", stack: 1, desc: "法术伤害提升。", tool: { family: "staff", atk: "咒", gather: [], cd: 0.3, reach: 0, dmg: 0, hint: "", tier: 2 } },
    staff3: { name: "神殿魔杖", short: "魔杖", kind: "tool", stack: 1, desc: "高阶法术伤害。", tool: { family: "staff", atk: "咒", gather: [], cd: 0.26, reach: 0, dmg: 0, hint: "", tier: 3 } },
    hood: { name: "亚麻风帽", short: "帽", kind: "armor", stack: 1, desc: "生命 +12，雾中时限 +2。", armor: { slot: "head", hp: 12, shroud: 2 } },
    emberhood: { name: "余烬风帽", short: "火帽", kind: "armor", stack: 1, desc: "生命 +18，雾中时限 +6。", armor: { slot: "head", hp: 18, shroud: 6 } },
    vest: { name: "兽皮背心", short: "衣", kind: "armor", stack: 1, desc: "生命 +22。", armor: { slot: "body", hp: 22 } },
    plate: { name: "石织胸甲", short: "甲", kind: "armor", stack: 1, desc: "生命 +40，攻击 +3。", armor: { slot: "body", hp: 40, atk: 3 } },
    cloak: { name: "守火披风", short: "披", kind: "armor", stack: 1, desc: "生命 +10，雾中时限 +5。", armor: { slot: "cloak", hp: 10, shroud: 5 } },
    shroudcloak: { name: "驱雾披风", short: "雾披", kind: "armor", stack: 1, desc: "雾中时限 +12，生命 +8。", armor: { slot: "cloak", hp: 8, shroud: 12 } },
    bandage: { name: "草药绷带", short: "布", kind: "consumable", stack: 20, desc: "使用后恢复 40 生命。", use: () => heal(40) },
    ration: { name: "干粮", short: "粮", kind: "consumable", stack: 20, desc: "恢复 20 生命与 40 耐力。", use: () => { heal(20); G.stamina = Math.min(100, G.stamina + 40); } },
    elixir: { name: "驱雾药剂", short: "药", kind: "consumable", stack: 10, desc: "雾中时限额外 +10 秒。", use: () => { G.buffShroud += 10; toast("雾中呼吸变得轻松"); } },
    tomeWard: { name: "符文秘卷", short: "卷", kind: "consumable", stack: 5, desc: "研读后符文经验 +60。", use: () => studyTome() }
  };

  const RECIPES = [
    { id: "axe2", tab: "tool", name: "精铁斧", desc: "伐木更快，也可作近战。", out: "axe2", wood: 8, stone: 12, bench: true },
    { id: "pick2", tab: "tool", name: "精铁镐", desc: "凿石取晶更利。", out: "pick2", wood: 6, stone: 14, bench: true },
    { id: "sickle2", tab: "tool", name: "精铁镰", desc: "收割更爽利。", out: "sickle2", wood: 6, fiber: 8, stone: 4, bench: true },
    { id: "staff2", tab: "tool", name: "余烬法杖", desc: "法术伤害提升。", out: "staff2", wood: 10, crystal: 6, bench: true },
    { id: "axe3", tab: "tool", name: "神殿斧", desc: "需火焰 II。", out: "axe3", wood: 10, crystal: 8, essence: 15, bench: true, flame: 2 },
    { id: "pick3", tab: "tool", name: "神殿镐", desc: "需火焰 II。", out: "pick3", stone: 16, crystal: 8, essence: 15, bench: true, flame: 2 },
    { id: "staff3", tab: "tool", name: "神殿魔杖", desc: "需火焰 III。", out: "staff3", wood: 12, crystal: 12, essence: 20, bench: true, flame: 3 },
    { id: "hood", tab: "armor", name: "亚麻风帽", desc: "就地可缝。", out: "hood", fiber: 8 },
    { id: "vest", tab: "armor", name: "兽皮背心", desc: "生命 +22。", out: "vest", fiber: 10, wood: 4 },
    { id: "cloak", tab: "armor", name: "守火披风", desc: "略抗迷雾。", out: "cloak", fiber: 10, crystal: 2, bench: true },
    { id: "emberhood", tab: "armor", name: "余烬风帽", desc: "需火焰 II。", out: "emberhood", fiber: 8, crystal: 6, essence: 8, bench: true, flame: 2 },
    { id: "plate", tab: "armor", name: "石织胸甲", desc: "需火焰 II。", out: "plate", stone: 16, fiber: 6, essence: 10, bench: true, flame: 2 },
    { id: "shroudcloak", tab: "armor", name: "驱雾披风", desc: "需火焰 III。", out: "shroudcloak", fiber: 12, crystal: 8, essence: 12, bench: true, flame: 3 },
    { id: "bandage", tab: "cons", name: "草药绷带 ×2", desc: "可就地包扎。", out: "bandage", outN: 2, fiber: 3 },
    { id: "ration", tab: "cons", name: "干粮 ×2", desc: "可就地烘制。", out: "ration", outN: 2, fiber: 2 },
    { id: "elixir", tab: "cons", name: "驱雾药剂", desc: "需工作台。", out: "elixir", crystal: 3, essence: 2, bench: true },
    { id: "tomeWard", tab: "magic", name: "符文秘卷", desc: "研读得符文经验。", out: "tomeWard", essence: 18, crystal: 4, bench: true }
  ];

  const SITE_DEFS = [
    { id: "drift", name: "流民营", faction: "流民会", ox: 44, oz: 14, color: 0xc4a35a, guards: 3, archers: 1, tribute: "wood" },
    { id: "iron", name: "铁誓堡", faction: "王国戍卫", ox: -44, oz: 10, color: 0x8a9098, guards: 4, archers: 1, tribute: "stone" },
    { id: "mire", name: "雾沼祠", faction: "雾祀", ox: 30, oz: -30, color: 0x2a8a7a, guards: 3, archers: 2, tribute: "crystal" },
    { id: "gate", name: "故土渡口", faction: "王国关隘", ox: 12, oz: -48, color: 0x6a3040, guards: 5, archers: 2, tribute: "essence", homeland: true, need: 2 }
  ];

  const BAG_SIZE = 24;
  const HOTBAR_LEN = 4;
  const GATHER_LABEL = { tree: "树木", rock: "岩石", crystal: "余烬晶", bush: "草丛" };
  const GATHER_WRONG = {
    tree: "换上手斧才能伐木",
    rock: "换上矿镐才能采石",
    crystal: "换上矿镐才能取晶",
    bush: "换上镰刀才能收割"
  };

  const G = {
    running: false,
    paused: false,
    seed: 1,
    time: 0,
    day: 0.34,
    mode: "play",
    hp: 100,
    maxHp: 100,
    stamina: 100,
    shroudLeft: 16,
    maxShroud: 16,
    buffShroud: 0,
    staff: 1,
    mana: 60,
    maxMana: 60,
    gearAtk: 0,
    gearShroud: 0,
    flameLevel: 0,
    flameLit: false,
    bag: Array(24).fill(null),
    hotbar: ["axe", "pick", "sickle", "staff"],
    paper: { head: null, body: null, cloak: null },
    equipSlot: 0,
    cd: { atk: 0, a0: 0, a1: 0, a2: 0, a3: 0 },
    yaw: 0,
    facing: 0,
    vx: 0,
    vz: 0,
    iframes: 0,
    wardT: 0,
    freezeAtk: 0,
    wardenDead: false,
    wardenSpawned: false,
    quality: "med",
    audioOn: true,
    inShroud: false,
    equip: "axe",
    rune: "power",
    runeXP: 0,
    sites: {},
    cores: [],
    followerN: 0,
    ordersT: 0,
    rapidT: 0,
    networkT: 0,
    markT: 0,
    overloadT: 0,
    day1Warned: false
  };

  let renderer, scene, camera, clock, sun, hemi, altarLight, staffLight;
  let terrain, waterMesh, shroudMesh, shroudUniforms;
  let heights, shroudCPU;
  let spawn = { x: 0, y: 5, z: 0 };
  let altarPos = new THREE.Vector3();
  let flameRadius = 0;
  let playerGrp, staffGem, cloak, weaponRoot, weaponMeshes = {}, targetRing;
  let bodyMat, cloakMat, hoodMat;
  let atkHeld = false;
  let swingT = 0;
  let wrongToastT = 0;
  let selectedBag = -1;
  let selectedGear = null;
  let craftTab = "tool";
  let rng;
  let trees = [];
  let rocks = [];
  let bushes = [];
  let crystals = [];
  let treeIM, leafIM, rockIM, bushIM, cryIM;
  let buildings = [];
  let sites = [];
  let minions = [];
  let turrets = [];
  let chosenRune = "power";
  let tributeAcc = 0;
  let raidT = 0;
  let lastNight = false;
  let regenAcc = 0;
  let ghost = null;
  let ghostType = "firetower";
  let ghostRot = 0;
  let enemies = [];
  let bolts = [];
  let particles = [];
  let particleIM;
  let drops = [];
  let boss = null;
  let fxGroup;
  let miniCache;
  let pointers = new Map();
  let joy = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let look = { id: null, x: 0, y: 0 };
  let keys = {};
  let camYaw = 0.15;
  let camPitch = 1.12;
  let camDist = 22;
  let pinch0 = 0;
  let interact = null;
  let toastT = 0;
  let saveAcc = 0;
  let spawnAcc = 0;
  let tutorialStep = 0;
  let rngI = 0;

  const TMP = {
    v: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    c: new THREE.Color(),
    m: new THREE.Matrix4(),
    e: new THREE.Euler(),
    dummy: new THREE.Object3D()
  };

  function idx(x, z) {
    return z * (SEG + 1) + x;
  }
  function wxOf(x) {
    return (x / SEG) * WORLD - WORLD / 2;
  }
  function wzOf(z) {
    return (z / SEG) * WORLD - WORLD / 2;
  }
  function heightAt(x, z) {
    const gx = sat((x + WORLD / 2) / WORLD) * SEG;
    const gz = sat((z + WORLD / 2) / WORLD) * SEG;
    const x0 = clamp(Math.floor(gx), 0, SEG - 1);
    const z0 = clamp(Math.floor(gz), 0, SEG - 1);
    const tx = gx - x0, tz = gz - z0;
    const h00 = heights[idx(x0, z0)];
    const h10 = heights[idx(x0 + 1, z0)];
    const h01 = heights[idx(x0, z0 + 1)];
    const h11 = heights[idx(x0 + 1, z0 + 1)];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }
  function shroudAt(x, z) {
    if (!G.flameLit) {
      /* still use mask, but altar radius 0 */
    }
    const d = Math.hypot(x - altarPos.x, z - altarPos.z);
    if (G.flameLit && d < flameRadius) return false;
    const gx = clamp(Math.round(sat((x + WORLD / 2) / WORLD) * SEG), 0, SEG);
    const gz = clamp(Math.round(sat((z + WORLD / 2) / WORLD) * SEG), 0, SEG);
    return shroudCPU[idx(gx, gz)] > 0.5;
  }
  function snap(v) {
    return Math.round(v / GRID) * GRID;
  }

  const AudioSys = {
    ctx: null,
    master: null,
    pad: [],
    init() {
      if (this.ctx) {
        this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = G.audioOn ? 0.28 : 0;
      this.master.connect(this.ctx.destination);
      this.drone();
    },
    setOn(on) {
      G.audioOn = on;
      if (this.master) this.master.gain.value = on ? 0.28 : 0;
    },
    drone() {
      const ctx = this.ctx;
      [55, 82.5, 110].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f1 = ctx.createBiquadFilter();
        o.type = i === 2 ? "triangle" : "sine";
        o.frequency.value = f;
        f1.type = "lowpass";
        f1.frequency.value = 420;
        g.gain.value = i === 0 ? 0.07 : 0.035;
        o.connect(f1).connect(g).connect(this.master);
        o.start();
        this.pad.push({ o, g });
      });
    },
    tone(freq, dur, type, vol, slide) {
      if (!this.ctx || !G.audioOn) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise(dur, vol) {
      if (!this.ctx || !G.audioOn) return;
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ctx.createBufferSource();
      s.buffer = n;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 800;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(this.master);
      s.start();
    }
  };

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    toastT = 2.2;
  }

  function floatText(x, y, z, text, cls) {
    const p = TMP.v.set(x, y, z).project(camera);
    const el = document.createElement("div");
    el.className = "dmg " + (cls || "");
    el.textContent = text;
    el.style.left = ((p.x * 0.5 + 0.5) * innerWidth) + "px";
    el.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function heal(n) {
    const a = Math.min(G.maxHp - G.hp, n);
    G.hp += a;
    if (a > 0) {
      floatText(playerGrp.position.x, playerGrp.position.y + 2.1, playerGrp.position.z, "+" + a, "heal");
      gainRuneXP("heal", a * 0.06);
    }
  }

  function studyTome() {
    G.runeXP += 60;
    applyGear();
    syncAbilityBar();
    toast("研读秘卷：符文经验 +60");
    AudioSys.tone(420, 0.35, "triangle", 0.12, 880);
  }

  function emptyBag() {
    return Array(BAG_SIZE).fill(null);
  }
  function starterLoadout() {
    G.bag = emptyBag();
    G.hotbar = ["axe", "pick", "sickle", "staff"];
    G.paper = { head: null, body: null, cloak: null };
    G.equipSlot = 0;
    G.equip = "axe";
  }
  function invSnapshot() {
    return {
      wood: countItem("wood"),
      stone: countItem("stone"),
      fiber: countItem("fiber"),
      crystal: countItem("crystal"),
      essence: countItem("essence"),
      embercore: countItem("embercore")
    };
  }
  function applyInventory(data) {
    if (data && Array.isArray(data.bag)) {
      G.bag = emptyBag();
      for (let i = 0; i < BAG_SIZE; i++) {
        const s = data.bag[i];
        G.bag[i] = s && s.id && ITEMS[s.id] ? { id: s.id, n: Math.max(1, s.n | 0) } : null;
      }
      G.hotbar = [null, null, null, null];
      const hb = Array.isArray(data.hotbar) ? data.hotbar : ["axe", "pick", "sickle", "staff"];
      for (let i = 0; i < HOTBAR_LEN; i++) {
        const id = hb[i];
        G.hotbar[i] = id && ITEMS[id] && ITEMS[id].kind === "tool" ? id : null;
      }
      G.paper = { head: null, body: null, cloak: null };
      if (data.paper) {
        for (const slot of ["head", "body", "cloak"]) {
          const id = data.paper[slot];
          if (id && ITEMS[id] && ITEMS[id].armor && ITEMS[id].armor.slot === slot) G.paper[slot] = id;
        }
      }
      G.equipSlot = clamp(data.equipSlot | 0, 0, HOTBAR_LEN - 1);
    } else {
      starterLoadout();
      const inv = (data && data.inv) || {};
      for (const k of ["wood", "stone", "fiber", "crystal", "essence", "embercore"]) {
        if (inv[k]) addItem(k, inv[k] | 0);
      }
      const fam = data && data.equip;
      if (fam) {
        const idx = G.hotbar.findIndex((id) => ITEMS[id] && ITEMS[id].tool && ITEMS[id].tool.family === fam);
        if (idx >= 0) G.equipSlot = idx;
      }
    }
    applyGear();
  }
  function countItem(id) {
    let n = 0;
    for (const s of G.bag) if (s && s.id === id) n += s.n;
    return n;
  }
  function addItem(id, n) {
    n = n | 0;
    if (n <= 0) return true;
    const def = ITEMS[id] || { stack: 99 };
    const stack = def.stack || 99;
    for (const s of G.bag) {
      if (s && s.id === id && s.n < stack) {
        const k = Math.min(stack - s.n, n);
        s.n += k;
        n -= k;
        if (n <= 0) { updateRes(); return true; }
      }
    }
    while (n > 0) {
      const i = G.bag.findIndex((s) => !s);
      if (i < 0) {
        toast("背包已满，部分材料未能拾取");
        updateRes();
        return false;
      }
      const k = Math.min(stack, n);
      G.bag[i] = { id, n: k };
      n -= k;
    }
    updateRes();
    return true;
  }
  function takeItem(id, n) {
    if (countItem(id) < n) return false;
    for (let i = 0; i < G.bag.length && n > 0; i++) {
      const s = G.bag[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(s.n, n);
      s.n -= k;
      n -= k;
      if (s.n <= 0) G.bag[i] = null;
    }
    updateRes();
    return true;
  }
  function canAfford(cost) {
    for (const k of ["wood", "stone", "fiber", "crystal", "essence", "embercore"]) {
      if ((cost[k] || 0) > countItem(k)) return false;
    }
    return true;
  }
  function pay(cost) {
    for (const k of ["wood", "stone", "fiber", "crystal", "essence", "embercore"]) {
      if (cost[k]) takeItem(k, cost[k]);
    }
  }
  function refund(cost, ratio) {
    for (const k of ["wood", "stone", "fiber", "crystal", "essence", "embercore"]) {
      if (cost[k]) addItem(k, Math.floor(cost[k] * ratio));
    }
  }
  function recipeCost(r) {
    return { wood: r.wood, stone: r.stone, fiber: r.fiber, crystal: r.crystal, essence: r.essence, embercore: r.embercore };
  }
  function runeDef() {
    return RUNES[G.rune] || RUNES.power;
  }
  function runeLevel() {
    return 1 + Math.floor(Math.sqrt(Math.max(0, G.runeXP) / 10));
  }
  function runeXPForLevel(lv) {
    return (lv - 1) * (lv - 1) * 10;
  }
  function isRune(id) {
    return G.rune === id;
  }
  function runeStep(id) {
    return isRune(id) ? runeLevel() - 1 : 0;
  }
  function gainRuneXP(kind, n) {
    const r = runeDef();
    const own = r.xp.indexOf(kind) >= 0;
    const gain = own ? n : n * 0.3;
    if (gain <= 0) return;
    const before = runeLevel();
    G.runeXP += gain;
    const after = runeLevel();
    if (after > before) {
      G.maxMana = 60 + (after - 1) * 12;
      G.mana = G.maxMana;
      applyGear();
      syncAbilityBar();
      toast(r.name + " 升至 " + after + " 级");
      AudioSys.tone(520, 0.3, "triangle", 0.12, 880);
      emit(playerGrp.position.x, playerGrp.position.y + 1.4, playerGrp.position.z, r.color, 22, 2.6);
    }
  }
  function dmgMult() {
    return 1 + 0.14 * runeStep("power");
  }
  function craftDiscount() {
    return Math.min(0.55, 0.07 * runeStep("precision")) + (G.rapidT > 0 ? 0.3 : 0);
  }
  function scaleCost(cost) {
    const d = craftDiscount();
    if (d <= 0) return cost;
    const out = {};
    for (const k of Object.keys(cost)) {
      const v = cost[k] || 0;
      out[k] = v > 0 ? Math.max(1, Math.round(v * (1 - d))) : 0;
    }
    return out;
  }
  function minionCap() {
    let cap = 2 + capturedCount();
    if (isRune("golem")) cap += 1 + Math.floor(runeLevel() / 2);
    if (isRune("life")) cap += Math.floor(runeLevel() / 2);
    return cap;
  }
  function countMinions(kind) {
    return minions.filter((m) => !kind || m.kind === kind).length;
  }
  function networkBonus() {
    const alive = minions.filter((m) => m.kind === "life").length;
    if (!isRune("life")) return 0;
    const base = 0.035 * alive * runeLevel();
    return Math.min(0.6, base) * (G.networkT > 0 ? 2 : 1);
  }
  function spendMana(n) {
    if (G.mana < n) {
      toast("魔力不足");
      AudioSys.tone(120, 0.1, "square", 0.05);
      return false;
    }
    G.mana -= n;
    return true;
  }
  function gainMana(n) {
    G.mana = Math.min(G.maxMana, G.mana + n);
  }
  function shroudCap() {
    return G.maxShroud + (G.gearShroud || 0) + runeStep("life") * 2;
  }
  function applyGear() {
    let hp = 100, sh = 0, atk = 0;
    for (const slot of ["head", "body", "cloak"]) {
      const it = ITEMS[G.paper[slot]];
      if (it && it.armor) {
        hp += it.armor.hp || 0;
        sh += it.armor.shroud || 0;
        atk += it.armor.atk || 0;
      }
    }
    hp += runeStep("life") * 16;
    atk += runeStep("power") * 2;
    G.maxHp = hp;
    G.gearShroud = sh;
    G.gearAtk = atk;
    G.maxMana = 60 + (runeLevel() - 1) * 12;
    if (G.mana > G.maxMana) G.mana = G.maxMana;
    if (G.hp > G.maxHp) G.hp = G.maxHp;
    if (bodyMat) {
      bodyMat.color.setHex(G.paper.body === "plate" ? 0x8a9098 : G.paper.body === "vest" ? 0x6a4428 : 0x3a2214);
    }
    if (hoodMat) {
      hoodMat.color.setHex(G.paper.head === "emberhood" ? 0x8a3a12 : G.paper.head === "hood" ? 0x8a7a5a : 0x1c100a);
    }
    if (cloakMat) {
      cloakMat.color.setHex(G.paper.cloak === "shroudcloak" ? 0x1c4a4a : G.paper.cloak === "cloak" ? 0x5a2410 : runeColor());
      cloakMat.emissive.setHex(G.paper.cloak === "shroudcloak" ? 0x0a2a28 : 0x000000);
      cloakMat.emissiveIntensity = G.paper.cloak === "shroudcloak" ? 0.35 : 0;
    }
    tintStaff();
  }
  function runeColor() {
    return runeDef().color;
  }
  function tintStaff() {
    const col = runeColor();
    if (staffGem && staffGem.material) {
      staffGem.material.color.setHex(col);
      staffGem.material.emissive.setHex(col);
    }
    if (staffLight) staffLight.color.setHex(col);
  }
  function applyRune(id, silent) {
    G.rune = RUNES[id] ? id : "power";
    applyGear();
    syncAbilityBar();
    const lab = $("quest-lab");
    if (lab) lab.textContent = "流放者 · " + runeDef().short + "纹";
    if (!silent) toast("符文：" + runeDef().name);
  }
  function capturedCount() {
    return sites.filter((s) => s.owner === "player").length;
  }
  function siteOwned(id) {
    const s = sites.find((x) => x.id === id);
    return !!(s && s.owner === "player");
  }
  function equippedTool() {
    const id = G.hotbar[G.equipSlot];
    const it = ITEMS[id];
    if (it && it.tool) return Object.assign({ id, name: it.name, short: it.short }, it.tool);
    return null;
  }
  function nearStation(kind) {
    if (!playerGrp) return null;
    for (const b of buildings) {
      const def = pieceDef(b.id);
      if (def && def.station === kind && Math.hypot(playerGrp.position.x - b.x, playerGrp.position.z - b.z) < 3.4) return b;
    }
    return null;
  }
  function nearBench() {
    return !!nearStation("craft");
  }
  function anyModalOpen() {
    return ["bag-modal", "craft-modal", "menu-modal", "dead-modal"].some((id) => {
      const el = $(id);
      return el && !el.classList.contains("hidden");
    });
  }
  function refreshPause() {
    G.paused = anyModalOpen();
  }

  function setupRenderer() {
    const canvas = $("c");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8aa7c4);
    scene.fog = new THREE.FogExp2(0x8aa7c4, 0.011);
    camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.15, 280);
    clock = new THREE.Clock();
    hemi = new THREE.HemisphereLight(0xb7d4ff, 0x3a2a18, 0.85);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0d2, 1.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0007;
    scene.add(sun);
    scene.add(sun.target);
    const amb = new THREE.AmbientLight(0x2a2430, 0.18);
    scene.add(amb);
    G.amb = amb;
    fxGroup = new THREE.Group();
    scene.add(fxGroup);
    applyQuality(G.quality, true);
  }

  function applyQuality(q, silent) {
    G.quality = q;
    const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 820;
    if (q === "low") {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
    } else if (q === "med") {
      renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
      renderer.shadowMap.enabled = true;
      sun.shadow.mapSize.set(512, 512);
    } else {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.shadowMap.enabled = true;
      sun.shadow.mapSize.set(1024, 1024);
    }
    $("btn-quality").textContent = "画质：" + ({ low: "低", med: "中", high: "高" }[q]);
    if (!silent) toast("画质已切换");
  }

  function generateWorld(seed) {
    rng = mulberry32(seed);
    rngI = seed;
    heights = new Float32Array((SEG + 1) * (SEG + 1));
    shroudCPU = new Float32Array((SEG + 1) * (SEG + 1));
    const mask = new Uint8Array((SEG + 1) * (SEG + 1));

    let best = -1e9;
    for (let z = 0; z <= SEG; z++) {
      for (let x = 0; x <= SEG; x++) {
        const u = x / SEG, v = z / SEG;
        const wx = wxOf(x), wz = wzOf(z);
        let h = fbm(u * 5.2, v * 5.2, seed, 5) * 0.72 + fbm(u * 13, v * 13, seed + 7, 3) * 0.28;
        const dx = u - 0.5, dz = v - 0.54;
        const island = Math.pow(Math.max(0, 1 - Math.hypot(dx, dz) * 1.92), 1.08);
        h = (h - 0.28) * 16 * island;
        const plateau = Math.hypot(u - 0.5, v - 0.57);
        if (plateau < 0.11) h = lerp(h, 4.7, 1 - plateau / 0.11);
        const dBoss = Math.hypot(wx, wz + WORLD * 0.33);
        if (dBoss < 16) h = lerp(h, 3.9, sat(1 - dBoss / 16));
        if (Math.abs(wx) < 2.4 && wz < spawn.z && wz > -WORLD * 0.33) {
          h = lerp(h, Math.max(h, 3.6), 0.45);
        }
        h = Math.max(h, 0.05);
        heights[idx(x, z)] = h;
        if (plateau < 0.09 && h > best) {
          best = h;
          spawn = { x: wx, y: h, z: wz };
        }
      }
    }
    altarPos.set(spawn.x, spawn.y, spawn.z);

    for (let z = 0; z <= SEG; z++) {
      for (let x = 0; x <= SEG; x++) {
        const wx = wxOf(x), wz = wzOf(z);
        const h = heights[idx(x, z)];
        const n = fbm(x * 0.07, z * 0.07, seed + 31, 3);
        const dAltar = Math.hypot(wx - altarPos.x, wz - altarPos.z);
        const valley = h < 3.15 + n * 1.4;
        const rim = Math.hypot(wx, wz) > 58 && n > 0.42;
        const towardBoss = wz < -12 && n > 0.38;
        const arena = Math.hypot(wx, wz + WORLD * 0.33) < 18;
        let s = 0;
        if (h > WATER + 0.2 && dAltar > 10 && (valley || rim || towardBoss || arena)) s = 1;
        shroudCPU[idx(x, z)] = s;
        mask[idx(x, z)] = s ? 255 : 0;
      }
    }

    const geo = new THREE.BufferGeometry();
    const nvert = (SEG + 1) * (SEG + 1);
    const pos = new Float32Array(nvert * 3);
    const col = new Float32Array(nvert * 3);
    const uv = new Float32Array(nvert * 2);
    const c = TMP.c;
    for (let z = 0; z <= SEG; z++) {
      for (let x = 0; x <= SEG; x++) {
        const i = idx(x, z);
        const wx = wxOf(x), wz = wzOf(z), h = heights[i];
        pos[i * 3] = wx;
        pos[i * 3 + 1] = h;
        pos[i * 3 + 2] = wz;
        uv[i * 2] = x / SEG;
        uv[i * 2 + 1] = z / SEG;
        const n = vnoise(x * 0.35, z * 0.35, seed);
        if (h < WATER + 0.25) c.set(0xb8a878);
        else if (shroudCPU[i] > 0.5) c.set(0x1c2e32).lerp(new THREE.Color(0x3a2450), 0.35 + n * 0.2);
        else if (h > 9.5) c.set(0xd8dde4);
        else if (h > 7.2) c.set(0x6a6e74);
        else {
          c.set(0x4d7c40).lerp(new THREE.Color(0x3a5c32), n);
          if (Math.abs(wx) < 2.2 && wz < altarPos.z && wz > -WORLD * 0.33) c.lerp(new THREE.Color(0x6b5344), 0.55);
        }
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
    }
    const indices = [];
    const pitch = SEG + 1;
    for (let z = 0; z < SEG; z++) {
      for (let x = 0; x < SEG; x++) {
        const a = z * pitch + x;
        indices.push(a, a + pitch, a + 1, a + 1, a + pitch, a + pitch + 1);
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    const wgeo = new THREE.PlaneGeometry(WORLD * 1.15, WORLD * 1.15, 24, 24);
    wgeo.rotateX(-Math.PI / 2);
    const wmat = new THREE.MeshLambertMaterial({
      color: 0x1a4d58,
      transparent: true,
      opacity: 0.72
    });
    wmat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         transformed.y += sin(position.x * 0.18 + uTime * 0.8) * 0.12 + cos(position.z * 0.16 + uTime * 0.6) * 0.1;`
      );
      wmat.userData.shader = shader;
    };
    waterMesh = new THREE.Mesh(wgeo, wmat);
    waterMesh.position.y = WATER;
    scene.add(waterMesh);

    const tex = new THREE.DataTexture(mask, SEG + 1, SEG + 1, THREE.RedFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.unpackAlignment = 1;
    tex.flipY = false;
    tex.needsUpdate = true;
    shroudUniforms = {
      uTime: { value: 0 },
      uRadius: { value: 0 },
      uFlame: { value: new THREE.Vector3() },
      uMask: { value: tex }
    };
    const smat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: shroudUniforms,
      vertexShader: `
        varying vec2 vUv; varying vec3 vPos;
        void main(){
          vUv = uv; vPos = position;
          vec3 p = position; p.y += 0.42;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: `
        uniform float uTime, uRadius; uniform vec3 uFlame; uniform sampler2D uMask;
        varying vec2 vUv; varying vec3 vPos;
        void main(){
          float m = texture2D(uMask, vUv).r;
          float d = length(vPos.xz - uFlame.xz);
          m *= smoothstep(uRadius, uRadius + 7.0, d);
          if(m < 0.1) discard;
          float n = sin(vPos.x*0.21 + uTime*0.7)*sin(vPos.z*0.17 + uTime*0.55);
          vec3 col = mix(vec3(0.10,0.03,0.20), vec3(0.12,0.55,0.48), 0.42 + n*0.12);
          float pulse = 0.32 + 0.08*sin(uTime*1.4 + d*0.2);
          gl_FragColor = vec4(col, pulse * m);
        }`
    });
    shroudMesh = new THREE.Mesh(geo.clone(), smat);
    scene.add(shroudMesh);

    addSky();
    scatterProps();
    buildAltar();
    buildBossRing();
    layoutSites();
    bakeMinimap();
    makeParticles();
  }

  function addSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(240, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x87a8c8, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.name = "sky";
    scene.add(sky);
  }

  function dummyMatrix(x, y, z, s, ry) {
    const d = TMP.dummy;
    d.position.set(x, y, z);
    d.rotation.set(0, ry || 0, 0);
    d.scale.setScalar(s || 1);
    d.updateMatrix();
    return d.matrix;
  }

  function scatterProps() {
    trees = []; rocks = []; bushes = []; crystals = [];
    const maxT = 420, maxR = 160, maxB = 140, maxC = 70;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6);
    const leafGeo = new THREE.ConeGeometry(1.05, 2.6, 7);
    const rockGeo = new THREE.IcosahedronGeometry(0.55, 0);
    const bushGeo = new THREE.SphereGeometry(0.38, 5, 4);
    const cryGeo = new THREE.OctahedronGeometry(0.32);
    treeIM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x4a3218 }), maxT);
    leafIM = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: 0x2f5a28, vertexColors: true }), maxT);
    rockIM = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x6a6a70, vertexColors: true }), maxR);
    bushIM = new THREE.InstancedMesh(bushGeo, new THREE.MeshLambertMaterial({ color: 0x4a6a30 }), maxB);
    cryIM = new THREE.InstancedMesh(cryGeo, new THREE.MeshLambertMaterial({ color: 0xff8a4a, emissive: 0xcc4a10, emissiveIntensity: 0.55 }), maxC);
    [treeIM, leafIM, rockIM, bushIM, cryIM].forEach((im) => {
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
    });
    leafIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxT * 3), 3);
    rockIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxR * 3), 3);

    const tryPlace = (arr, imA, imB, max, pred, make) => {
      let n = 0, guard = 0;
      while (n < max && guard < max * 18) {
        guard++;
        const x = (rng() - 0.5) * WORLD * 0.92;
        const z = (rng() - 0.5) * WORLD * 0.92;
        const y = heightAt(x, z);
        if (!pred(x, z, y)) continue;
        make(n, x, y, z);
        n++;
      }
      if (imA) imA.count = n;
      if (imB) imB.count = n;
      return n;
    };

    tryPlace(trees, treeIM, leafIM, maxT, (x, z, y) => {
      if (y < WATER + 0.7) return false;
      if (Math.hypot(x - altarPos.x, z - altarPos.z) < 6) return false;
      const steep = Math.abs(heightAt(x + 1.2, z) - heightAt(x - 1.2, z));
      if (steep > 1.6) return false;
      return rng() < (shroudAt(x, z) ? 0.55 : 0.42);
    }, (i, x, y, z) => {
      const s = 0.75 + rng() * 0.7;
      const ry = rng() * TAU;
      const dead = shroudAt(x, z) && rng() < 0.45;
      treeIM.setMatrixAt(i, dummyMatrix(x, y + 0.7 * s, z, s, ry));
      leafIM.setMatrixAt(i, dummyMatrix(x, y + 2.05 * s, z, s, ry));
      TMP.c.set(dead ? 0x4a4450 : (rng() < 0.2 ? 0x5a8a38 : 0x3d7a34));
      leafIM.setColorAt(i, TMP.c);
      trees.push({ i, x, y, z, hp: 3, alive: true, s });
    });
    leafIM.instanceColor.needsUpdate = true;

    for (let k = 0; k < 14; k++) {
      const a = rng() * TAU;
      const r = 8 + rng() * 10;
      const x = altarPos.x + Math.cos(a) * r;
      const z = altarPos.z + Math.sin(a) * r;
      const y = heightAt(x, z);
      if (y < WATER + 0.6 || trees.length >= maxT) continue;
      const i = trees.length;
      const s = 0.85 + rng() * 0.3;
      treeIM.setMatrixAt(i, dummyMatrix(x, y + 0.7 * s, z, s, rng() * TAU));
      leafIM.setMatrixAt(i, dummyMatrix(x, y + 2.05 * s, z, s, 0));
      leafIM.setColorAt(i, TMP.c.set(0x356a2c));
      trees.push({ i, x, y, z, hp: 3, alive: true, s });
      treeIM.count = trees.length;
      leafIM.count = trees.length;
    }
    treeIM.instanceMatrix.needsUpdate = true;
    leafIM.instanceMatrix.needsUpdate = true;
    leafIM.instanceColor.needsUpdate = true;

    tryPlace(rocks, rockIM, null, maxR, (x, z, y) => y > WATER + 0.4 && rng() < 0.5, (i, x, y, z) => {
      const s = 0.5 + rng() * 1.1;
      rockIM.setMatrixAt(i, dummyMatrix(x, y + 0.25 * s, z, s, rng() * TAU));
      TMP.c.set(0x6a6a70).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
      rockIM.setColorAt(i, TMP.c);
      rocks.push({ i, x, y, z, hp: 3, alive: true });
    });
    rockIM.instanceColor.needsUpdate = true;

    tryPlace(bushes, bushIM, null, maxB, (x, z, y) => y > WATER + 0.5 && !shroudAt(x, z) && rng() < 0.4, (i, x, y, z) => {
      bushIM.setMatrixAt(i, dummyMatrix(x, y + 0.25, z, 0.7 + rng() * 0.6, 0));
      bushes.push({ i, x, y, z, hp: 1, alive: true });
    });

    tryPlace(crystals, cryIM, null, maxC, (x, z, y) => y > WATER + 0.4 && shroudAt(x, z), (i, x, y, z) => {
      cryIM.setMatrixAt(i, dummyMatrix(x, y + 0.45, z, 0.8 + rng() * 0.6, rng()));
      crystals.push({ i, x, y, z, hp: 2, alive: true });
    });
  }

  function hideInstance(im, i) {
    TMP.dummy.position.set(0, -50, 0);
    TMP.dummy.scale.setScalar(0.001);
    TMP.dummy.rotation.set(0, 0, 0);
    TMP.dummy.updateMatrix();
    im.setMatrixAt(i, TMP.dummy.matrix);
    im.instanceMatrix.needsUpdate = true;
  }

  function buildAltar() {
    const g = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0x6a645c });
    const gold = new THREE.MeshLambertMaterial({ color: 0xc4a35a });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.55, 10), stone);
    base.position.y = 0.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.12, 6, 16), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.52;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.45, 8), stone);
    bowl.position.y = 0.7;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 1.1, 6),
      new THREE.MeshLambertMaterial({ color: 0xffb14a, emissive: 0xff6a1a, emissiveIntensity: 0.2 })
    );
    flame.position.y = 1.35;
    flame.name = "flame";
    g.add(base, ring, bowl, flame);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.35), stone);
      const a = (i / 6) * TAU;
      p.position.set(Math.cos(a) * 2.5, 0.9, Math.sin(a) * 2.5);
      g.add(p);
    }
    g.position.copy(altarPos);
    g.position.y = altarPos.y;
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(g);
    G.altar = g;
    altarLight = new THREE.PointLight(0xff8a32, 0, 18, 1.6);
    altarLight.position.set(altarPos.x, altarPos.y + 2.2, altarPos.z);
    scene.add(altarLight);
  }

  function buildBossRing() {
    const cx = 0, cz = -WORLD * 0.33;
    const y = heightAt(cx, cz);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a4450 });
    const g = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4 + (i % 3), 0.7), mat);
      p.position.set(cx + Math.cos(a) * 11, y + 1.7, cz + Math.sin(a) * 11);
      p.lookAt(cx, y + 1.7, cz);
      p.castShadow = true;
      g.add(p);
    }
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.6, 10), mat);
    dais.position.set(cx, y + 0.3, cz);
    g.add(dais);
    scene.add(g);
    G.bossPos = new THREE.Vector3(cx, y, cz);
  }

  function findLand(x, z) {
    for (let r = 0; r <= 18; r += 2) {
      for (let a = 0; a < 10; a++) {
        const xx = x + Math.cos((a / 10) * TAU) * r;
        const zz = z + Math.sin((a / 10) * TAU) * r;
        const y = heightAt(xx, zz);
        if (y > WATER + 0.95 && Math.hypot(xx, zz) < WORLD * 0.44 && Math.hypot(xx - altarPos.x, zz - altarPos.z) > 16) {
          return { x: xx, y, z: zz };
        }
      }
    }
    return { x, y: heightAt(x, z), z };
  }

  function clearPropsNear(x, z, r) {
    const rr = r * r;
    const hide = (arr, imA, imB) => {
      for (const n of arr) {
        if (!n.alive) continue;
        if (dist2(n.x, n.z, x, z) < rr) {
          n.alive = false;
          if (imA) hideInstance(imA, n.i);
          if (imB) hideInstance(imB, n.i);
        }
      }
    };
    hide(trees, treeIM, leafIM);
    hide(rocks, rockIM, null);
    hide(bushes, bushIM, null);
    hide(crystals, cryIM, null);
  }

  function makeHumanoid(col, accent) {
    const g = new THREE.Group();
    const cloth = new THREE.MeshLambertMaterial({ color: col });
    const acc = new THREE.MeshLambertMaterial({ color: accent });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.72, 6), cloth);
    body.position.y = 0.68;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), skin);
    head.position.y = 1.16;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 4), acc);
    pole.position.set(0.28, 0.88, 0.02);
    g.add(body, head, pole);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function layoutSites() {
    sites.forEach((s) => { if (s.group) scene.remove(s.group); });
    sites = [];
    SITE_DEFS.forEach((def) => {
      const p = findLand(def.ox, def.oz);
      clearPropsNear(p.x, p.z, 9);
      const owner = G.sites[def.id] === "player" ? "player" : "enemy";
      const col = owner === "player" ? runeColor() : def.color;
      const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a1c });
      const wall = new THREE.MeshLambertMaterial({ color: owner === "player" ? 0x6a5340 : 0x4a4450 });
      const ban = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 });
      const g = new THREE.Group();
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.35, 8), wall);
      dais.position.y = 0.12;
      g.add(dais);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.1, 0.28), wood);
        post.position.set(Math.cos(a) * 3.6, 1.05, Math.sin(a) * 3.6);
        g.add(post);
      }
      for (let i = 0; i < 3; i++) {
        const hut = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.6), wall);
        const a = 0.7 + i * 1.7;
        hut.position.set(Math.cos(a) * 5.2, 0.7, Math.sin(a) * 5.2);
        g.add(hut);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), wood);
        roof.position.set(hut.position.x, 1.55, hut.position.z);
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.2, 5), wood);
      pole.position.y = 1.7;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.7), ban);
      flag.position.set(0.55, 2.85, 0);
      flag.name = "flag";
      g.add(pole, flag);
      g.position.set(p.x, p.y, p.z);
      scene.add(g);
      sites.push({
        id: def.id, name: def.name, faction: def.faction, homeland: !!def.homeland,
        need: def.need || 0, tribute: def.tribute, color: def.color,
        x: p.x, y: p.y, z: p.z, owner, group: g, flag,
        guards: def.guards, archers: def.archers
      });
    });
  }

  function paintSite(s) {
    const col = s.owner === "player" ? runeColor() : s.color;
    if (s.flag && s.flag.material) {
      s.flag.material.color.setHex(col);
      s.flag.material.emissive.setHex(col);
    }
  }

  function siteGuardsAlive(id) {
    return enemies.some((e) => !e.dead && e.site === id);
  }

  function populateSiteGuards() {
    enemies.slice().forEach((e) => {
      if (e.site) killEnemyQuiet(e);
    });
    sites.forEach((s) => {
      if (s.owner === "player") return;
      const nG = s.guards || 3, nA = s.archers || 0;
      for (let i = 0; i < nG; i++) {
        const a = (i / Math.max(1, nG)) * TAU;
        const e = spawnEnemy("guard", s.x + Math.cos(a) * 4.2, s.z + Math.sin(a) * 4.2);
        e.site = s.id;
        e.home = { x: s.x, z: s.z };
        e.ess = 3;
      }
      for (let i = 0; i < nA; i++) {
        const a = 0.4 + (i / Math.max(1, nA)) * TAU;
        const e = spawnEnemy("archer", s.x + Math.cos(a) * 5.4, s.z + Math.sin(a) * 5.4);
        e.site = s.id;
        e.home = { x: s.x, z: s.z };
        e.ess = 3;
      }
      if (s.homeland) {
        const e = spawnEnemy("captain", s.x, s.z + 1.2);
        e.site = s.id;
        e.home = { x: s.x, z: s.z };
        e.ess = 10;
      }
    });
  }

  function killEnemyQuiet(e) {
    e.dead = true;
    if (e.mesh) scene.remove(e.mesh);
    enemies = enemies.filter((x) => x !== e);
    if (boss === e) boss = null;
  }

  function captureSite(s) {
    s.owner = "player";
    G.sites[s.id] = "player";
    paintSite(s);
    addItem("essence", 5);
    toast(s.homeland ? "故土渡口已落入你手。反攻之路打开了。" : (s.name + "已纳入你的领地，可在旗帜下招募"));
    AudioSys.tone(240, 0.35, "triangle", 0.12, 620);
    emit(s.x, s.y + 2, s.z, runeColor(), 22, 3);
  }

  const MINIONS = {
    follower: { name: "麾下", hp: 46, spd: 4.8, dmg: 7, atkCd: 1.15, worker: false },
    golem: { name: "劳作傀儡", hp: 60, spd: 3.9, dmg: 5, atkCd: 1.4, worker: true },
    wargolem: { name: "战斗傀儡", hp: 130, spd: 3.6, dmg: 14, atkCd: 1.3, worker: false },
    life: { name: "生命造物", hp: 54, spd: 5.2, dmg: 10, atkCd: 1.0, worker: false, core: true }
  };

  function makeMinionMesh(kind) {
    if (kind === "golem" || kind === "wargolem") {
      const g = new THREE.Group();
      const metal = new THREE.MeshLambertMaterial({ color: kind === "wargolem" ? 0x6a7480 : 0x9aa4b0 });
      const glow = new THREE.MeshLambertMaterial({ color: 0xc4a35a, emissive: 0xff8a32, emissiveIntensity: 0.6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.36), metal);
      body.position.y = 0.7;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.26), metal);
      head.position.y = 1.14;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), glow);
      eye.position.set(0, 1.15, 0.16);
      g.add(body, head, eye);
      for (let i = -1; i <= 1; i += 2) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), metal);
        arm.position.set(i * 0.33, 0.66, 0);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.15), metal);
        leg.position.set(i * 0.14, 0.2, 0);
        g.add(arm, leg);
      }
      if (kind === "wargolem") {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.2), new THREE.MeshLambertMaterial({ color: 0xc9ced6 }));
        blade.position.set(0.42, 0.8, 0.1);
        g.add(blade);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    if (kind === "life") {
      const g = new THREE.Group();
      const flesh = new THREE.MeshLambertMaterial({ color: 0x4a8a52, emissive: 0x123a1a, emissiveIntensity: 0.4 });
      const core = new THREE.MeshLambertMaterial({ color: 0x9aff9a, emissive: 0x2ade6a, emissiveIntensity: 0.85 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 7, 6), flesh);
      body.scale.set(1, 1.25, 1);
      body.position.y = 0.62;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), core);
      c.position.y = 0.72;
      c.name = "core";
      g.add(body, c);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        const tent = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 5), flesh);
        tent.position.set(Math.cos(a) * 0.24, 0.2, Math.sin(a) * 0.24);
        tent.rotation.x = Math.PI;
        g.add(tent);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    const h = makeHumanoid(runeColor(), 0xc4a35a);
    h.scale.setScalar(0.92);
    return h;
  }

  function spawnMinion(kind, x, z, lv) {
    const def = MINIONS[kind] || MINIONS.follower;
    const level = Math.max(1, lv || 1);
    const mesh = makeMinionMesh(kind);
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    mesh.scale.multiplyScalar(1 + (level - 1) * 0.06);
    scene.add(mesh);
    const hp = Math.round(def.hp * (1 + (level - 1) * 0.35) * (1 + runeStep(kind === "life" ? "life" : "golem") * 0.08));
    const m = {
      kind, mesh, x, y, z, lv: level, xp: 0,
      hp, maxHp: hp, spd: def.spd, dmg: def.dmg, atkCd: 0, hurt: 0,
      worker: !!def.worker, target: null, workCd: 0
    };
    minions.push(m);
    G.followerN = minions.filter((q) => q.kind === "follower").length;
    return m;
  }

  function minionDmg(m) {
    const base = m.dmg * (1 + (m.lv - 1) * 0.25);
    const rune = m.kind === "life" ? runeStep("life") : (m.kind === "golem" || m.kind === "wargolem") ? runeStep("golem") : 0;
    return base * (1 + rune * 0.12) * (G.ordersT > 0 ? 1.5 : 1);
  }

  function minionXP(m, n) {
    m.xp += n;
    const need = m.lv * 8;
    if (m.xp >= need) {
      m.xp = 0;
      m.lv += 1;
      m.maxHp = Math.round(m.maxHp * 1.18);
      m.hp = m.maxHp;
      m.mesh.scale.multiplyScalar(1.04);
      floatText(m.x, m.y + 1.6, m.z, "Lv" + m.lv, "magic");
    }
  }

  function killMinion(m) {
    if (m.dead) return;
    m.dead = true;
    emit(m.x, m.y + 0.8, m.z, m.kind === "life" ? 0x7ade8a : 0x9aa4b0, 14, 2.2);
    if (MINIONS[m.kind] && MINIONS[m.kind].core) {
      G.cores.push(m.lv);
      toast("躯壳崩解，核心已回收（" + m.lv + " 级）");
    } else {
      toast((MINIONS[m.kind] || MINIONS.follower).name + "倒下了");
    }
    scene.remove(m.mesh);
    minions = minions.filter((x) => x !== m);
    G.followerN = minions.filter((q) => q.kind === "follower").length;
  }

  function reviveCore() {
    if (!G.cores.length) { toast("没有可复活的核心"); return; }
    if (countMinions() >= minionCap()) { toast("麾下已达上限"); return; }
    const cost = 14 + Math.max(...G.cores) * 3;
    if (!spendMana(cost)) return;
    let bi = 0;
    G.cores.forEach((lv, i) => { if (lv > G.cores[bi]) bi = i; });
    const lv = G.cores.splice(bi, 1)[0];
    const m = spawnMinion("life", playerGrp.position.x + 1.4, playerGrp.position.z + 1.4, lv);
    toast("造物复生，等级 " + m.lv + " 保留");
    emit(m.x, m.y + 1, m.z, 0x7ade8a, 20, 2.6);
    AudioSys.tone(440, 0.3, "triangle", 0.12, 720);
  }

  function restoreMinions(n) {
    minions.forEach((m) => scene.remove(m.mesh));
    minions = [];
    if (!playerGrp) return;
    for (let i = 0; i < n; i++) {
      spawnMinion("follower", playerGrp.position.x + 1.2 + i * 0.6, playerGrp.position.z + 1.4);
    }
  }

  function findWorkNode(m) {
    let best = null, bd = 42 * 42;
    const pools = [["tree", trees], ["rock", rocks], ["bush", bushes]];
    for (const [type, arr] of pools) {
      for (const n of arr) {
        if (!n.alive) continue;
        if (shroudAt(n.x, n.z)) continue;
        const d = dist2(m.x, m.z, n.x, n.z);
        if (d < bd) { bd = d; best = { type, node: n }; }
      }
    }
    return best;
  }

  function updateMinions(dt) {
    if (!playerGrp || !minions.length) return;
    const px = playerGrp.position.x, pz = playerGrp.position.z;
    minions.slice().forEach((m, i) => {
      if (m.dead) return;
      m.atkCd = Math.max(0, m.atkCd - dt);
      m.hurt = Math.max(0, m.hurt - dt);
      let foe = null, fd = m.worker ? 7 : 13;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - m.x, e.z - m.z);
        if (d < fd) { fd = d; foe = e; }
      }
      let tx, tz, spd = m.spd * (G.ordersT > 0 ? 1.35 : 1);
      if (foe) {
        tx = foe.x; tz = foe.z;
        if (fd < 1.8 && m.atkCd <= 0) {
          m.atkCd = (MINIONS[m.kind] || MINIONS.follower).atkCd;
          hurtEnemy(foe, minionDmg(m), false);
          minionXP(m, 1);
          if (m.kind === "life" || m.kind === "golem" || m.kind === "wargolem") gainRuneXP("kill", 0.6);
        }
      } else if (m.worker) {
        if (!m.target || !m.target.node.alive) m.target = findWorkNode(m);
        if (m.target) {
          tx = m.target.node.x; tz = m.target.node.z;
          const d = Math.hypot(tx - m.x, tz - m.z);
          m.workCd = Math.max(0, m.workCd - dt);
          if (d < 2.0 && m.workCd <= 0) {
            m.workCd = 1.05 / (1 + runeStep("golem") * 0.06);
            const n = m.target.node;
            n.hp -= 1;
            emit(n.x, n.y + 0.8, n.z, 0xc4b494, 4, 1.2);
            AudioSys.noise(0.05, 0.03);
            if (n.hp <= 0) {
              harvestNode(m.target.type, n, 0.8);
              minionXP(m, 2);
              gainRuneXP("work", 2.2);
              m.target = null;
            }
          }
        } else {
          tx = px + Math.sin(i * 1.7) * 3;
          tz = pz + Math.cos(i * 1.7) * 3;
        }
      } else {
        tx = px + Math.sin(i * 1.7 + 0.8) * (2.2 + i * 0.5);
        tz = pz + Math.cos(i * 1.7 + 0.8) * (2.2 + i * 0.5);
      }
      const dx = tx - m.x, dz = tz - m.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > (foe ? 1.5 : 0.5)) {
        const pos = { x: m.x, z: m.z };
        moveWithSlide(pos, (dx / dist) * spd * dt, (dz / dist) * spd * dt, 0.32);
        m.x = pos.x; m.z = pos.z;
      }
      m.y = heightAt(m.x, m.z);
      m.mesh.position.set(m.x, m.y, m.z);
      m.mesh.rotation.y = Math.atan2(dx, dz);
      if (m.kind === "life" && G.networkT > 0) {
        const core = m.mesh.getObjectByName("core");
        if (core) core.position.y = 0.72 + Math.sin(G.time * 6 + i) * 0.06;
      }
      if (m.hp <= 0) killMinion(m);
    });
  }

  function hurtMinion(m, dmg) {
    if (m.dead) return;
    const resist = m.kind === "life" ? networkBonus() : 0;
    m.hp -= Math.max(1, dmg * (1 - resist));
    m.hurt = 0.12;
    floatText(m.x, m.y + 1.4, m.z, "-" + Math.round(dmg * (1 - resist)));
    if (m.hp <= 0) killMinion(m);
  }

  function nearestMinion(x, z, range) {
    let best = null, bd = range;
    for (const m of minions) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  function updateTribute(dt) {
    tributeAcc += dt;
    if (tributeAcc < 48) return;
    tributeAcc = 0;
    const owned = sites.filter((s) => s.owner === "player");
    if (!owned.length) return;
    owned.forEach((s) => addItem(s.tribute, 1));
    toast("领地贡赋已入行囊");
  }

  function makeMage() {
    const g = new THREE.Group();
    const cloth = new THREE.MeshLambertMaterial({ color: 0x3a2214 });
    const cloakM = new THREE.MeshLambertMaterial({ color: 0x1c100a });
    const hoodM = new THREE.MeshLambertMaterial({ color: 0x1c100a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
    const woodM = new THREE.MeshLambertMaterial({ color: 0x5a3a1c });
    const ironM = new THREE.MeshLambertMaterial({ color: 0x8a9098 });
    bodyMat = cloth;
    cloakMat = cloakM;
    hoodMat = hoodM;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.78, 8), cloth);
    body.position.y = 0.72;
    cloak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.35, 8), cloakM);
    cloak.position.y = 0.82;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skin);
    head.position.y = 1.32;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, TAU, 0, 1.1), hoodM);
    hood.position.y = 1.4;

    weaponRoot = new THREE.Group();
    weaponRoot.position.set(0.42, 0.92, 0.08);
    weaponRoot.rotation.z = -0.22;

    const staff = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.85, 6), woodM);
    staffGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13),
      new THREE.MeshLambertMaterial({ color: 0xff7a32, emissive: 0xff5510, emissiveIntensity: 0.85 })
    );
    staffGem.position.y = 0.95;
    staff.add(pole, staffGem);

    const axe = new THREE.Group();
    axe.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 1.2, 6), woodM));
    const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.48), ironM);
    axeBlade.position.set(0.02, 0.42, 0.14);
    axe.add(axeBlade);

    const pick = new THREE.Group();
    pick.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 1.2, 6), woodM));
    const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.1), ironM);
    pickHead.position.y = 0.48;
    const pickTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 5), ironM);
    pickTip.rotation.z = Math.PI / 2;
    pickTip.position.set(0.34, 0.48, 0);
    pick.add(pickHead, pickTip);

    const sickle = new THREE.Group();
    sickle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.95, 6), woodM));
    const blade = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.045, 5, 10, Math.PI * 1.15),
      ironM
    );
    blade.position.set(0.12, 0.42, 0);
    blade.rotation.set(0.2, 1.2, 0.4);
    sickle.add(blade);

    weaponMeshes = { axe, pick, sickle, staff };
    weaponRoot.add(axe, pick, sickle, staff);
    g.add(cloak, body, head, hood, weaponRoot);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    staffLight = new THREE.PointLight(0xff7a32, 0, 7, 2);
    g.add(staffLight);
    staffLight.position.set(0.4, 1.8, 0.1);
    playerGrp = g;
    scene.add(g);
    g.position.set(spawn.x, spawn.y, spawn.z);

    targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 20),
      new THREE.MeshBasicMaterial({ color: 0xc4a35a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.visible = false;
    scene.add(targetRing);
  }

  function makeEnemyMesh(kind) {
    const g = new THREE.Group();
    if (kind === "crawler") {
      const m = new THREE.MeshLambertMaterial({ color: 0x314224 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 5), m);
      body.scale.set(1.1, 0.55, 1.45);
      body.position.y = 0.32;
      g.add(body);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 4), m);
        leg.position.set(i < 2 ? -0.28 : 0.28, 0.18, i % 2 ? 0.28 : -0.28);
        leg.rotation.z = i < 2 ? 0.6 : -0.6;
        g.add(leg);
      }
    } else if (kind === "spitter") {
      const m = new THREE.MeshLambertMaterial({ color: 0x4a2a58 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.1, 6), m);
      body.position.y = 0.7;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 6, 6), new THREE.MeshLambertMaterial({ color: 0x6a3a78, emissive: 0x330044, emissiveIntensity: 0.4 }));
      head.position.y = 1.3;
      g.add(body, head);
    } else if (kind === "wraith") {
      const m = new THREE.MeshLambertMaterial({ color: 0x203048, transparent: true, opacity: 0.8, emissive: 0x112244, emissiveIntensity: 0.5 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 7), m);
      body.position.y = 1.1;
      g.add(body);
    } else if (kind === "guard" || kind === "archer" || kind === "captain") {
      const col = kind === "captain" ? 0x6a3040 : kind === "archer" ? 0x3a4a38 : 0x4a4458;
      const acc = kind === "captain" ? 0xc4a35a : 0x8a9098;
      const h = makeHumanoid(col, acc);
      while (h.children.length) g.add(h.children[0]);
    } else {
      const m = new THREE.MeshLambertMaterial({ color: 0x3a1450, emissive: 0x220133, emissiveIntensity: 0.4 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 2.2, 8), m);
      body.position.y = 1.3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), m);
      head.position.y = 2.6;
      g.add(body, head);
      for (let i = -1; i <= 1; i += 2) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0xc4a35a }));
        ant.position.set(i * 0.35, 3.3, 0);
        ant.rotation.z = -i * 0.5;
        g.add(ant);
      }
    }
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return g;
  }

  function makeParticles() {
    const geo = new THREE.SphereGeometry(0.12, 5, 4);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    particleIM = new THREE.InstancedMesh(geo, mat, 140);
    particleIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(140 * 3), 3);
    particleIM.count = 140;
    scene.add(particleIM);
    particles = [];
    for (let i = 0; i < 140; i++) {
      particles.push({ i, life: 0, x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, s: 1 });
      hideInstance(particleIM, i);
    }
  }

  function emit(x, y, z, color, n, spd) {
    let left = n;
    for (const p of particles) {
      if (left <= 0) break;
      if (p.life > 0) continue;
      p.life = rand(0.35, 0.8);
      p.x = x; p.y = y; p.z = z;
      p.vx = rand(-1, 1) * spd;
      p.vy = rand(0.2, 1) * spd;
      p.vz = rand(-1, 1) * spd;
      p.s = rand(0.5, 1.4);
      particleIM.setColorAt(p.i, TMP.c.set(color));
      left--;
    }
    particleIM.instanceColor.needsUpdate = true;
  }

  function bakeMinimap() {
    miniCache = document.createElement("canvas");
    miniCache.width = 128;
    miniCache.height = 128;
    const ctx = miniCache.getContext("2d");
    const img = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const wx = (x / 127 - 0.5) * WORLD;
        const wz = -((y / 127 - 0.5) * WORLD);
        const h = heightAt(wx, wz);
        const i = (y * 128 + x) * 4;
        let r, g, b;
        if (h < WATER) { r = 36; g = 92; b = 112; }
        else if (shroudAt(wx, wz)) { r = 96; g = 52; b = 140; }
        else if (h > 8) { r = 148; g = 150; b = 156; }
        else { r = 72; g = 148; b = 78; }
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function drawMinimap() {
    const cnv = $("minimap");
    const ctx = cnv.getContext("2d");
    ctx.drawImage(miniCache, 0, 0);
    const to = (x, z) => [(x / WORLD + 0.5) * 128, (-z / WORLD + 0.5) * 128];
    ctx.fillStyle = "#e8c25a";
    let p = to(altarPos.x, altarPos.z);
    ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, TAU); ctx.fill();
    sites.forEach((s) => {
      p = to(s.x, s.z);
      ctx.fillStyle = s.owner === "player" ? "#e8c25a" : "#c07050";
      ctx.fillRect(p[0] - 2.4, p[1] - 2.4, 4.8, 4.8);
    });
    buildings.forEach((b) => {
      const def = pieceDef(b.id);
      if (!def) return;
      p = to(b.x, b.z);
      ctx.fillStyle = def.ward ? "#ff9a3a" : def.turret ? "#9adfff" : "#8a7a5a";
      ctx.fillRect(p[0] - 1.1, p[1] - 1.1, 2.2, 2.2);
    });
    ctx.fillStyle = "#7ade8a";
    minions.forEach((m) => {
      p = to(m.x, m.z);
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.5, 0, TAU); ctx.fill();
    });
    if (!G.wardenDead) {
      ctx.fillStyle = "#e05050";
      p = to(G.bossPos.x, G.bossPos.z);
      ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = "#fff";
    p = to(playerGrp.position.x, playerGrp.position.z);
    ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[0] + Math.sin(G.facing) * 6, p[1] - Math.cos(G.facing) * 6);
    ctx.stroke();
  }

  function setFlameLevel(lv, lit) {
    G.flameLevel = lv;
    G.flameLit = lit;
    flameRadius = lit ? 11 + lv * 9 : 0;
    G.maxShroud = 16 + lv * 6;
    const flame = G.altar.getObjectByName("flame");
    if (flame) {
      flame.scale.setScalar(lit ? 0.7 + lv * 0.35 : 0.15);
      flame.material.emissiveIntensity = lit ? 0.6 + lv * 0.3 : 0.05;
    }
    altarLight.intensity = lit ? 1.2 + lv * 0.7 : 0;
    shroudUniforms.uRadius.value = flameRadius;
    shroudUniforms.uFlame.value.set(altarPos.x, altarPos.y, altarPos.z);
    if (miniCache) bakeMinimap();
  }

  function abilityDef(i) {
    return runeDef().abil[i];
  }
  function abilityUnlocked(i) {
    const a = abilityDef(i);
    return !!a && runeLevel() >= a.lv;
  }
  function syncAbilityBar() {
    for (let i = 0; i < 4; i++) {
      const el = $("sk-" + i);
      if (!el) continue;
      const a = abilityDef(i);
      const ok = abilityUnlocked(i);
      el.classList.toggle("locked", !ok);
      const lab = el.querySelector("b");
      if (lab) lab.textContent = a ? a.short : "";
      el.title = a ? (a.name + (ok ? "" : "（需 " + a.lv + " 级）")) : "";
    }
  }

  function pieceDef(id) {
    return PIECES.find((p) => p.id === id);
  }

  function makePieceMesh(id, ghosting) {
    const g = new THREE.Group();
    const opacity = ghosting ? 0.42 : 1;
    const mat = (c, e) =>
      new THREE.MeshLambertMaterial({
        color: c,
        transparent: ghosting,
        opacity,
        emissive: e || 0x000000,
        emissiveIntensity: e ? 0.5 : 0,
        depthWrite: !ghosting
      });
    const add = (mesh) => {
      mesh.castShadow = !ghosting;
      mesh.receiveShadow = true;
      g.add(mesh);
    };
    if (id === "floor") add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), mat(0x7a6a52)));
    else if (id === "fence") {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2, 0.14, 0.14), mat(0x6a4a22));
      rail.position.y = 0.34;
      const rail2 = rail.clone();
      rail2.position.y = -0.06;
      add(rail); add(rail2);
      for (let i = -1; i <= 1; i += 2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), mat(0x5a3a1c));
        post.position.set(i * 0.9, 0.05, 0);
        add(post);
      }
    } else if (id === "gate") {
      for (let i = -1; i <= 1; i += 2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.6, 0.24), mat(0x5a3a1c));
        post.position.set(i * 0.9, 0.25, 0);
        add(post);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.18, 0.18), mat(0x6a4a22));
      top.position.y = 1.0;
      add(top);
    } else if (id === "spike") {
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 4), mat(0x8a8a90));
        s.position.set(-0.7 + i * 0.35, 0.1, 0);
        s.rotation.z = (i - 2) * 0.12;
        add(s);
      }
    } else if (id === "chest") {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), mat(0x6a3a18)));
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.64), mat(0x8a5a28));
      lid.position.y = 0.32;
      add(lid);
    } else if (id === "workshop") {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.1), mat(0x6a4a22));
      add(top);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.8, 0.14), mat(0x4a3218));
        leg.position.set(i < 2 ? -0.7 : 0.7, -0.45, i % 2 ? 0.42 : -0.42);
        add(leg);
      }
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.24), mat(0x8a9098));
      anvil.position.set(-0.35, 0.22, 0);
      add(anvil);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), mat(0x4a3218));
      rack.position.set(0.7, 0.55, 0);
      add(rack);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 5, 10), mat(0x7a6a52));
      wheel.position.set(0.42, 0.3, 0.2);
      wheel.name = "spin";
      add(wheel);
    } else if (id === "firetower") {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.95, 0.5, 7), mat(0x6a645c));
      base.position.y = -0.9;
      add(base);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 2.1, 7), mat(0x7a6a58));
      col.position.y = 0.2;
      add(col);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.4, 0.4, 8), mat(0x6a645c));
      bowl.position.y = 1.4;
      add(bowl);
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.0, 6), mat(0xffb14a, 0xff6a1a));
      fire.position.y = 2.0;
      fire.name = "fire";
      add(fire);
    } else if (id === "watchtower") {
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), mat(0x5a3a1c));
        leg.position.set(i < 2 ? -0.6 : 0.6, -0.4, i % 2 ? 0.6 : -0.6);
        add(leg);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.8), mat(0x6a4a22));
      deck.position.y = 0.95;
      add(deck);
      const rail = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 4, 8), mat(0x5a3a1c));
      rail.rotation.x = Math.PI / 2;
      rail.position.y = 1.34;
      add(rail);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 4), mat(0x4a3a2a));
      roof.position.y = 2.05;
      roof.rotation.y = Math.PI / 4;
      add(roof);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 4, 8, Math.PI), mat(0xc4a35a));
      bow.position.y = 1.2;
      bow.name = "aim";
      add(bow);
    } else if (id === "golemworks") {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 1.6), mat(0x6a645c));
      add(slab);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 0.18), mat(0x8a9098));
      frame.position.set(-0.8, 0.85, 0);
      const frame2 = frame.clone();
      frame2.position.x = 0.8;
      add(frame); add(frame2);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.22), mat(0x8a9098));
      beam.position.y = 1.6;
      add(beam);
      const gear = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 5, 8), mat(0xc4a35a, 0x6a4400));
      gear.position.set(0, 0.9, 0);
      gear.name = "spin";
      add(gear);
    } else if (id === "lifealtar") {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.32, 9), mat(0x6a645c));
      add(ring);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.15, 0.26), mat(0x7a7468));
        st.position.set(Math.cos(a) * 1.15, 0.6, Math.sin(a) * 1.15);
        add(st);
      }
      const seed = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), mat(0x7ade8a, 0x2a8a4a));
      seed.position.y = 1.0;
      seed.name = "float";
      add(seed);
    } else if (id === "farm" || id === "herbary") {
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2, 0.14, 2), mat(id === "farm" ? 0x5a4028 : 0x4a4028));
      add(soil);
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.42, 4),
          mat(id === "farm" ? 0xc8b45a : 0x6aa85a)
        );
        c.position.set(-0.66 + (i % 3) * 0.66, 0.28, -0.66 + Math.floor(i / 3) * 0.66);
        add(c);
      }
    }
    return g;
  }

  function fillBuildTray() {
    const row = $("piece-row");
    row.innerHTML = "";
    const names = { wood: "木", stone: "石", fiber: "纤", crystal: "晶" };
    PIECES.forEach((p) => {
      const b = document.createElement("button");
      b.className = "piece" + (p.id === ghostType ? " sel" : "");
      b.dataset.ui = "1";
      const cost = placeCost(p.id);
      const parts = Object.entries(cost).filter(([, v]) => v).map(([k, v]) => names[k] + v).join(" ");
      b.innerHTML = "<b>" + p.name + "</b><i>" + parts + "</i>";
      b.title = p.desc || "";
      b.onclick = () => {
        ghostType = p.id;
        fillBuildTray();
        rebuildGhost();
      };
      row.appendChild(b);
    });
  }

  function rebuildGhost() {
    if (ghost) scene.remove(ghost);
    ghost = makePieceMesh(ghostType, true);
    scene.add(ghost);
  }

  function ghostPos() {
    const d = 3.1;
    const x = snap(playerGrp.position.x + Math.sin(G.facing) * d);
    const z = snap(playerGrp.position.z + Math.cos(G.facing) * d);
    const y = heightAt(x, z);
    return { x, y, z };
  }

  function placeCost(id) {
    const p = pieceDef(id);
    if (!p) return {};
    return scaleCost({ wood: p.wood || 0, stone: p.stone || 0, fiber: p.fiber || 0, crystal: p.crystal || 0 });
  }

  function placeBlocker(x, z, id) {
    if (heightAt(x, z) < WATER + 0.35) return "水中或太低，换个地方";
    const solid = pieceDef(id).solid;
    for (const b of buildings) {
      if (Math.abs(b.x - x) < 0.2 && Math.abs(b.z - z) < 0.2) return "这里已经有东西了";
      if (solid && b.solid && Math.abs(b.x - x) < 1.2 && Math.abs(b.z - z) < 1.2) return "挨得太近，退开一格";
    }
    if (!canAfford(placeCost(id))) return "材料不足";
    return "";
  }

  function canPlace(x, z, id) {
    if (heightAt(x, z) < WATER + 0.35) return false;
    const solid = pieceDef(id).solid;
    for (const b of buildings) {
      if (Math.abs(b.x - x) < 0.2 && Math.abs(b.z - z) < 0.2) return false;
      if (solid && b.solid && Math.abs(b.x - x) < 1.2 && Math.abs(b.z - z) < 1.2) return false;
    }
    return canAfford(placeCost(id));
  }

  function placeBuilding() {
    const p = ghostPos();
    const id = ghostType;
    const why = placeBlocker(p.x, p.z, id);
    if (why) {
      toast("无法放置：" + why);
      AudioSys.tone(120, 0.12, "square", 0.06);
      return;
    }
    const def = pieceDef(id);
    pay(placeCost(id));
    addBuilding(id, p.x, p.y, p.z, ghostRot);
    if (def.station || def.ward || def.turret || def.produce) toast(def.name + "立起：" + def.desc);
    emit(p.x, p.y + 1, p.z, runeColor(), 8, 1.5);
    AudioSys.tone(240, 0.1, "triangle", 0.08);
    AudioSys.noise(0.08, 0.06);
    gainRuneXP("build", 3);
    updateRes();
  }

  function addBuilding(id, x, y, z, rot) {
    const def = pieceDef(id);
    if (!def) return null;
    const mesh = makePieceMesh(id, false);
    mesh.position.set(x, y + def.y, z);
    mesh.rotation.y = rot * Math.PI * 0.5;
    scene.add(mesh);
    const b = {
      id, x, y, z, rot, mesh,
      solid: !!def.solid, spike: !!def.spike, fence: !!def.fence,
      cd: 0, prod: def.produce ? def.produce.every * (0.55 + Math.random() * 0.3) : 0,
      spin: mesh.getObjectByName("spin"),
      fire: mesh.getObjectByName("fire"),
      floatPart: mesh.getObjectByName("float"),
      aim: mesh.getObjectByName("aim")
    };
    if (def.ward) {
      const l = new THREE.PointLight(0xff8a32, 1.1, def.ward + 4, 1.7);
      l.position.set(x, y + 2.4, z);
      scene.add(l);
      b.light = l;
    }
    buildings.push(b);
    return b;
  }

  function safeRadiusAt(x, z) {
    let best = 0;
    for (const b of buildings) {
      const def = pieceDef(b.id);
      if (!def || !def.ward) continue;
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < def.ward) best = Math.max(best, 1 - d / def.ward);
    }
    return best;
  }

  function updateStructures(dt) {
    const lit = 0.55 + Math.sin(G.time * 7) * 0.12;
    const boost = G.overloadT > 0 ? 3 : 1;
    for (const b of buildings) {
      const def = pieceDef(b.id);
      if (!def) continue;
      if (b.spin) b.spin.rotation.z += dt * 1.6 * boost;
      if (b.floatPart) {
        b.floatPart.rotation.y += dt * 1.1;
        b.floatPart.position.y = 1.0 + Math.sin(G.time * 1.7) * 0.12;
      }
      if (b.fire) {
        b.fire.scale.set(1, 0.85 + Math.sin(G.time * 9 + b.x) * 0.16, 1);
        if (b.fire.material) b.fire.material.emissiveIntensity = lit;
      }
      if (b.light) b.light.intensity = 0.9 + Math.sin(G.time * 6 + b.z) * 0.25;
      if (def.ward) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - b.x, e.z - b.z) < def.ward * 0.55) {
            e.hp -= 5 * dt * boost;
            if (e.hp <= 0) { killEnemy(e); continue; }
          }
        }
      }
      if (def.turret) {
        b.cd = Math.max(0, b.cd - dt * boost);
        if (b.cd <= 0) {
          let foe = null, fd = def.turret.range;
          for (const e of enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - b.x, e.z - b.z);
            if (d < fd) { fd = d; foe = e; }
          }
          if (foe) {
            b.cd = def.turret.cd;
            if (b.aim) b.aim.rotation.y = Math.atan2(foe.x - b.x, foe.z - b.z);
            spawnBolt(b.x, b.y + 2.0, b.z, foe.x - b.x, foe.z - b.z, {
              spd: 26, life: 1.4, dmg: def.turret.dmg + runeStep("precision") * 2,
              friendly: true, color: 0xc4a35a, size: 0.1
            });
            AudioSys.tone(420, 0.05, "square", 0.03, 220);
          }
        }
      }
      if (def.produce) {
        const rate = dt * boost * (1 + runeStep("life") * 0.18);
        b.prod -= rate;
        if (b.prod <= 0) {
          b.prod = def.produce.every;
          addItem(def.produce.id, 1);
          emit(b.x, b.y + 0.6, b.z, 0x9adf6a, 6, 1.2);
        }
      }
    }
    for (let i = turrets.length - 1; i >= 0; i--) {
      const t = turrets[i];
      t.life -= dt;
      t.cd = Math.max(0, t.cd - dt);
      t.mesh.rotation.y += dt * 2.2;
      if (t.cd <= 0) {
        let foe = null, fd = 16;
        for (const e of enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - t.x, e.z - t.z);
          if (d < fd) { fd = d; foe = e; }
        }
        if (foe) {
          t.cd = 0.55;
          spawnBolt(t.x, t.y + 1.1, t.z, foe.x - t.x, foe.z - t.z, {
            spd: 30, life: 1.2, dmg: 10 + runeStep("precision") * 3, friendly: true,
            color: 0x7fd7ff, size: 0.12
          });
        }
      }
      if (t.life <= 0) {
        scene.remove(t.mesh);
        turrets.splice(i, 1);
      }
    }
  }

  function removeBuilding() {
    const p = ghostPos();
    let best = null, bd = 2.6;
    for (const b of buildings) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) { toast("附近没有可拆的建筑"); return; }
    scene.remove(best.mesh);
    if (best.light) scene.remove(best.light);
    buildings = buildings.filter((b) => b !== best);
    refund(placeCost(best.id), 0.5);
    toast("拆除并回收一半材料");
    updateRes();
  }

  function blocked(x, z, rad, ignorePlayer) {
    if (heightAt(x, z) < WATER + 0.12) return true;
    for (const t of trees) {
      if (!t.alive) continue;
      if (dist2(x, z, t.x, t.z) < (0.45 + rad) * (0.45 + rad)) return true;
    }
    for (const b of buildings) {
      if (!b.solid) continue;
      let hw = 0.85, hd = 0.85;
      if (b.fence) {
        const yaw = b.rot * Math.PI * 0.5;
        const along = Math.abs(Math.cos(yaw)) > 0.5;
        hw = along ? 1.05 : 0.24;
        hd = along ? 0.24 : 1.05;
      }
      if (Math.abs(x - b.x) < hw + rad && Math.abs(z - b.z) < hd + rad) return true;
    }
    return false;
  }

  function moveWithSlide(obj, dx, dz, rad) {
    const nx = obj.x + dx, nz = obj.z + dz;
    if (!blocked(nx, nz, rad)) { obj.x = nx; obj.z = nz; return; }
    if (!blocked(obj.x + dx, obj.z, rad)) obj.x += dx;
    else if (!blocked(obj.x, obj.z + dz, rad)) obj.z += dz;
  }

  function nearestNode(arr, range) {
    let best = null, bd = range * range;
    const x = playerGrp.position.x, z = playerGrp.position.z;
    for (const n of arr) {
      if (!n.alive) continue;
      const d = dist2(x, z, n.x, n.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  function getInteract() {
    const x = playerGrp.position.x, z = playerGrp.position.z;
    if (Math.hypot(x - altarPos.x, z - altarPos.z) < 3.3) {
      if (!G.flameLit) return { type: "light", label: "点燃火种" };
      return { type: "upgrade", label: "升级火焰" };
    }
    const craft = nearStation("craft");
    if (craft) return { type: "bench", label: "工坊", b: craft };
    const gw = nearStation("golem");
    if (gw) return { type: "golemstation", label: "造傀儡", b: gw };
    const la = nearStation("life");
    if (la) return { type: "lifestation", label: G.cores.length ? ("复活造物 ×" + G.cores.length) : "复生坛", b: la };
    for (const s of sites) {
      if (Math.hypot(x - s.x, z - s.z) > 3.6) continue;
      if (s.owner === "player") {
        if (countMinions() < minionCap()) return { type: "recruit", label: "招募麾下", site: s };
        return { type: "hall", label: s.name + "（领地）", site: s };
      }
      if (s.need && capturedCount() < s.need) return { type: "locked", label: "关隘紧闭", site: s };
      if (siteGuardsAlive(s.id)) return { type: "assault", label: "攻打·" + s.name, site: s };
      return { type: "capture", label: "占领·" + s.name, site: s };
    }
    return null;
  }

  function gatherPool(kind) {
    if (kind === "tree") return trees;
    if (kind === "rock") return rocks;
    if (kind === "bush") return bushes;
    if (kind === "crystal") return crystals;
    return [];
  }

  function nodeScore(n, reach) {
    const dx = n.x - playerGrp.position.x, dz = n.z - playerGrp.position.z;
    const d = Math.hypot(dx, dz);
    if (d > reach) return -1;
    const fx = Math.sin(G.facing), fz = Math.cos(G.facing);
    const dot = d < 0.05 ? 1 : (dx * fx + dz * fz) / d;
    if (dot < -0.15 && d > 1.15) return -1;
    return (dot * 1.8) - d * 0.35;
  }

  function bestGather(kinds, reach) {
    let best = null, score = -1e9;
    for (const kind of kinds) {
      for (const n of gatherPool(kind)) {
        if (!n.alive) continue;
        const s = nodeScore(n, reach);
        if (s > score) {
          score = s;
          best = { type: kind, node: n };
        }
      }
    }
    return best;
  }

  function anyGatherInReach(reach) {
    const kinds = ["tree", "rock", "bush", "crystal"];
    let best = null, score = -1e9;
    for (const kind of kinds) {
      for (const n of gatherPool(kind)) {
        if (!n.alive) continue;
        const s = nodeScore(n, reach);
        if (s > score) {
          score = s;
          best = { type: kind, node: n };
        }
      }
    }
    return best;
  }

  function fillHotbar() {
    const bar = $("hotbar");
    if (!bar) return;
    bar.innerHTML = "";
    for (let i = 0; i < HOTBAR_LEN; i++) {
      const id = G.hotbar[i];
      const it = ITEMS[id];
      const b = document.createElement("button");
      b.className = "slot" + (G.equipSlot === i ? " sel" : "");
      b.dataset.ui = "1";
      b.dataset.slot = String(i);
      b.innerHTML = it
        ? `<span class="n">${i + 1}</span><b>${it.short}</b><i>${it.name}</i>`
        : `<span class="n">${i + 1}</span><b>·</b><i>空</i>`;
      b.onclick = () => {
        const bagOpen = $("bag-modal") && !$("bag-modal").classList.contains("hidden");
        if (bagOpen && selectedBag >= 0) equipToHotbar(selectedBag, i);
        else setEquipSlot(i);
      };
      bar.appendChild(b);
    }
  }

  function setEquipSlot(i, silent) {
    G.equipSlot = clamp(i, 0, HOTBAR_LEN - 1);
    const tool = equippedTool();
    const family = tool ? tool.family : null;
    G.equip = family || "fist";
    G.staff = (tool && tool.tier) || 1;
    Object.keys(weaponMeshes).forEach((k) => {
      if (weaponMeshes[k]) weaponMeshes[k].visible = k === family;
    });
    if (staffLight) staffLight.intensity = family === "staff" ? 0.65 : 0;
    const btn = $("btn-atk");
    if (btn) {
      btn.textContent = tool ? tool.atk : "拳";
      btn.dataset.tool = family || "fist";
    }
    document.querySelectorAll("#hotbar .slot").forEach((el) => {
      el.classList.toggle("sel", Number(el.dataset.slot) === G.equipSlot);
    });
    if (!silent) {
      toast(tool ? ("手持：" + tool.name) : "空手");
      AudioSys.tone(260, 0.07, "triangle", 0.05);
    }
  }

  function setEquip(id, silent) {
    const idx = G.hotbar.indexOf(id);
    setEquipSlot(idx >= 0 ? idx : 0, silent);
  }

  function equipToHotbar(bagIndex, slot) {
    const s = G.bag[bagIndex];
    if (!s) return;
    const it = ITEMS[s.id];
    if (!it || it.kind !== "tool") { toast("这不是可手持的工具"); return; }
    const old = G.hotbar[slot];
    const nid = s.id;
    s.n -= 1;
    if (s.n <= 0) G.bag[bagIndex] = null;
    G.hotbar[slot] = nid;
    if (old) addItem(old, 1);
    selectedBag = -1;
    setEquipSlot(slot, true);
    fillHotbar();
    renderBag();
    toast("已装备 " + it.name);
  }

  function wearFromBag(bagIndex) {
    const s = G.bag[bagIndex];
    if (!s) return;
    const it = ITEMS[s.id];
    if (!it || it.kind !== "armor" || !it.armor) { toast("这不是防具"); return; }
    const slot = it.armor.slot;
    const old = G.paper[slot];
    G.paper[slot] = s.id;
    G.bag[bagIndex] = old ? { id: old, n: 1 } : null;
    const oldMax = G.maxHp;
    applyGear();
    if (G.maxHp > oldMax) G.hp = Math.min(G.maxHp, G.hp + (G.maxHp - oldMax));
    selectedBag = -1;
    renderBag();
    toast("穿上 " + it.name);
  }

  function unequipGear(slot) {
    const id = G.paper[slot];
    if (!id) return;
    if (!addItem(id, 1)) return;
    G.paper[slot] = null;
    applyGear();
    renderBag();
    toast("已卸下");
  }

  function useFromBag(bagIndex) {
    const s = G.bag[bagIndex];
    if (!s) return;
    const it = ITEMS[s.id];
    if (!it || !it.use) { toast("无法使用"); return; }
    it.use();
    s.n -= 1;
    if (s.n <= 0) G.bag[bagIndex] = null;
    renderBag();
    updateRes();
  }

  function dropFromBag(bagIndex) {
    const s = G.bag[bagIndex];
    if (!s) return;
    s.n -= 1;
    toast("丢弃 " + (ITEMS[s.id] ? ITEMS[s.id].name : s.id));
    if (s.n <= 0) {
      G.bag[bagIndex] = null;
      selectedBag = -1;
    }
    renderBag();
    updateRes();
  }

  function itemDesc(id) {
    const it = ITEMS[id];
    if (!it) return id;
    let extra = "";
    if (it.tool) extra = `挥击「${it.tool.atk}」 伤害 ${it.tool.dmg || ("法术" + (it.tool.tier || 1))}`;
    if (it.armor) extra = `生命+${it.armor.hp || 0} 雾抗+${it.armor.shroud || 0} 攻击+${it.armor.atk || 0}`;
    return `<b>${it.name}</b>　${it.desc || ""}<br/>${extra}`;
  }

  function renderBag() {
    const grid = $("bag-grid");
    if (!grid) return;
    grid.innerHTML = "";
    G.bag.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "cell" + (selectedBag === i ? " sel" : "");
      b.dataset.ui = "1";
      if (s) {
        const it = ITEMS[s.id] || { short: "?", name: s.id };
        b.innerHTML = `<b>${it.short}</b>${s.n > 1 ? `<span class="qty">${s.n}</span>` : ""}`;
      }
      b.onclick = () => {
        selectedBag = i;
        selectedGear = null;
        renderBag();
      };
      grid.appendChild(b);
    });
    ["head", "body", "cloak"].forEach((slot) => {
      const el = $("gear-" + slot);
      if (!el) return;
      const id = G.paper[slot];
      const it = ITEMS[id];
      el.classList.toggle("sel", selectedGear === slot);
      el.querySelector("i").textContent = it ? it.short : "";
      el.onclick = () => {
        selectedGear = slot;
        selectedBag = -1;
        renderBag();
      };
    });
    const det = $("bag-detail");
    if (selectedBag >= 0 && G.bag[selectedBag]) det.innerHTML = itemDesc(G.bag[selectedBag].id);
    else if (selectedGear && G.paper[selectedGear]) det.innerHTML = itemDesc(G.paper[selectedGear]) + "<br/>再次点「装备」可卸下。";
    else det.textContent = "点选物品：工具装到当前快捷栏，防具穿上，消耗品使用。";
  }

  function openBag() {
    selectedBag = -1;
    selectedGear = null;
    closeCraft();
    renderBag();
    $("bag-modal").classList.remove("hidden");
    refreshPause();
  }
  function closeBag() {
    $("bag-modal").classList.add("hidden");
    refreshPause();
  }
  function closeCraft() {
    $("craft-modal").classList.add("hidden");
    refreshPause();
  }
  function bagActionEquip() {
    if (selectedGear) { unequipGear(selectedGear); return; }
    if (selectedBag < 0 || !G.bag[selectedBag]) return;
    const it = ITEMS[G.bag[selectedBag].id];
    if (it && it.kind === "tool") equipToHotbar(selectedBag, G.equipSlot);
    else if (it && it.kind === "armor") wearFromBag(selectedBag);
    else toast("不能装备这件物品");
  }

  function doInteract() {
    const it = getInteract();
    if (!it) return;
    if (it.type === "light") {
      if (countItem("wood") < 8) { toast("需要 8 木材点燃祭坛"); return; }
      takeItem("wood", 8);
      setFlameLevel(1, true);
      toast("流放者的火种燃起，迷雾退去");
      emit(altarPos.x, altarPos.y + 2, altarPos.z, 0xff8a32, 28, 3);
      AudioSys.tone(180, 0.5, "sine", 0.16, 420);
      return;
    }
    if (it.type === "upgrade") {
      const lv = G.flameLevel;
      const costs = [
        null,
        { crystal: 6, essence: 12 },
        { crystal: 12, essence: 32 },
        { crystal: 20, essence: 60, embercore: 1 }
      ];
      if (lv >= 4) { toast("火焰已达神殿圆满"); return; }
      const c = costs[lv];
      if (!canAfford(c)) {
        toast(lv === 3 ? "需要余烬核心（击败雾狱守卫）与大量魂晶" : "材料不足，无法升级火焰");
        return;
      }
      pay(c);
      setFlameLevel(lv + 1, true);
      toast("火焰升至 " + ["", "I", "II", "III", "IV"][G.flameLevel] + " 级，雾幕后退");
      emit(altarPos.x, altarPos.y + 2, altarPos.z, 0xffd27a, 36, 4);
      updateRes();
      return;
    }
    if (it.type === "bench") {
      openCraft();
      return;
    }
    if (it.type === "locked") {
      toast("先占领岛上至少两处地盘，再攻故土渡口");
      return;
    }
    if (it.type === "assault") {
      toast("先击败旗帜周围的驻军");
      return;
    }
    if (it.type === "capture") {
      captureSite(it.site);
      return;
    }
    if (it.type === "recruit") {
      if (countMinions() >= minionCap()) { toast("麾下已达上限（占更多地盘可扩编）"); return; }
      if (countItem("essence") < 6) { toast("招募需要 6 魂"); return; }
      takeItem("essence", 6);
      spawnMinion("follower", it.site.x + 1.5, it.site.z + 1.5);
      toast("麾下加入。当前 " + countMinions() + " / " + minionCap());
      AudioSys.tone(360, 0.18, "triangle", 0.08);
      return;
    }
    if (it.type === "hall") {
      toast(it.site.name + "已是你的领地。麾下会随你作战。");
      return;
    }
    if (it.type === "golemstation") {
      if (countMinions() >= minionCap()) { toast("麾下已达上限"); return; }
      const cost = { wood: 6, stone: 6 };
      if (!canAfford(cost)) { toast("需要 木6 石6"); return; }
      if (!spendMana(18)) return;
      pay(cost);
      const m = spawnMinion("golem", it.b.x + 1.6, it.b.z + 1.6);
      toast("劳作傀儡启动，会自己去采集");
      emit(m.x, m.y + 1, m.z, 0x9aa4b0, 16, 2.2);
      gainRuneXP("work", 3);
      return;
    }
    if (it.type === "lifestation") {
      reviveCore();
    }
  }

  function harvestNode(type, n, mult) {
    const k = (mult || 1) * (1 + 0.07 * runeStep("life"));
    const amt = (base) => Math.max(1, Math.round(base * k));
    n.alive = false;
    if (type === "tree") {
      hideInstance(treeIM, n.i);
      hideInstance(leafIM, n.i);
      addItem("wood", amt(3 + ((Math.random() * 3) | 0)));
      if (Math.random() < 0.35) addItem("fiber", 1);
    } else if (type === "rock") {
      hideInstance(rockIM, n.i);
      addItem("stone", amt(2 + ((Math.random() * 2) | 0)));
    } else if (type === "bush") {
      hideInstance(bushIM, n.i);
      addItem("fiber", amt(2));
    } else if (type === "crystal") {
      hideInstance(cryIM, n.i);
      addItem("crystal", amt(1 + (Math.random() < 0.4 ? 1 : 0)));
      gainMana(6);
    }
    updateRes();
  }

  function hitNode(it) {
    const n = it.node;
    n.hp -= 1;
    AudioSys.noise(0.07, 0.08);
    emit(n.x, n.y + 0.8, n.z, it.type === "crystal" ? 0xff8a32 : 0xc4b494, 6, 1.4);
    if (navigator.vibrate) navigator.vibrate(10);
    if (n.hp > 0) return;
    harvestNode(it.type, n, 1);
    gainRuneXP("work", 0.8);
  }

  function nearestEnemy(range) {
    let best = null, bd = range * range;
    const x = playerGrp.position.x, z = playerGrp.position.z;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist2(x, z, e.x, e.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function useEquipment() {
    if (G.paused || G.mode === "build" || G.hp <= 0) return;
    if (G.cd.atk > 0) return;
    const tool = equippedTool();
    G.cd.atk = tool ? tool.cd : 0.45;
    swingT = 0.22;
    G.stamina = Math.max(0, G.stamina - 2);

    if (!tool) {
      const foe = nearestEnemy(1.8);
      if (foe) {
        hurtEnemy(foe, (5 + (G.gearAtk || 0)) * dmgMult(), false);
        AudioSys.tone(160, 0.08, "square", 0.06);
      } else {
        const wrong = anyGatherInReach(2.1);
        if (wrong && wrongToastT <= 0) {
          toast(GATHER_WRONG[wrong.type] || "先装备工具");
          wrongToastT = 1.25;
        }
        AudioSys.tone(140, 0.06, "triangle", 0.03);
      }
      return;
    }

    if (tool.family === "staff") {
      const d = facingDir();
      G.facing = Math.atan2(d.x, d.z);
      if (staffGem) staffGem.getWorldPosition(TMP.v);
      else weaponRoot.getWorldPosition(TMP.v);
      spawnBolt(TMP.v.x, TMP.v.y, TMP.v.z, d.x, d.z, {
        spd: 24, life: 1.15, dmg: staffDmg(), friendly: true, color: runeColor(), size: 0.12 + (tool.tier || 1) * 0.03
      });
      AudioSys.tone(320 + (tool.tier || 1) * 40, 0.08, "square", 0.06, 180);
      emit(TMP.v.x, TMP.v.y, TMP.v.z, 0xff7a32, 4, 1.2);
      return;
    }

    const gather = bestGather(tool.gather, tool.reach);
    if (gather) {
      G.facing = Math.atan2(gather.node.x - playerGrp.position.x, gather.node.z - playerGrp.position.z);
      playerGrp.rotation.y = G.facing;
      hitNode(gather);
      return;
    }

    const foe = nearestEnemy(tool.reach + 0.15);
    if (foe) {
      G.facing = Math.atan2(foe.x - playerGrp.position.x, foe.z - playerGrp.position.z);
      playerGrp.rotation.y = G.facing;
      hurtEnemy(foe, (tool.dmg + (G.gearAtk || 0)) * dmgMult(), false);
      AudioSys.tone(180, 0.08, "square", 0.07);
      emit(foe.x, foe.y + 1, foe.z, 0xc4b494, 6, 1.6);
      return;
    }

    const wrong = anyGatherInReach(tool.reach);
    if (wrong) {
      G.facing = Math.atan2(wrong.node.x - playerGrp.position.x, wrong.node.z - playerGrp.position.z);
      if (wrongToastT <= 0) {
        toast(GATHER_WRONG[wrong.type] || "换一件工具");
        wrongToastT = 1.25;
      }
      AudioSys.tone(90, 0.08, "square", 0.04);
      return;
    }
    AudioSys.tone(140, 0.06, "triangle", 0.03);
  }

  function updateAimAssist() {
    if (G.mode === "build") {
      if (targetRing) targetRing.visible = false;
      return;
    }
    const tool = equippedTool();
    let mark = null, hint = "";
    if (tool && tool.family !== "staff") {
      const g = bestGather(tool.gather, tool.reach);
      if (g) {
        mark = g.node;
        hint = GATHER_LABEL[g.type] || tool.hint;
      }
    }
    if (targetRing) {
      if (mark) {
        targetRing.visible = true;
        targetRing.position.set(mark.x, mark.y + 0.06, mark.z);
        targetRing.material.opacity = 0.55 + Math.sin(G.time * 6) * 0.2;
      } else targetRing.visible = false;
    }
    const btn = $("btn-atk");
    if (btn) btn.classList.toggle("ready", !!mark);
    document.querySelectorAll("#hotbar .slot").forEach((el) => {
      el.classList.toggle("ready", Number(el.dataset.slot) === G.equipSlot && !!mark);
    });
    const ah = $("aim-hint");
    if (ah) {
      ah.textContent = hint && tool ? ("可" + tool.atk + " · " + hint) : "";
      ah.classList.toggle("show", !!hint);
    }
  }

  function spawnEnemy(kind, x, z) {
    const def = {
      crawler: { hp: 30, spd: 3.3, dmg: 8, range: 1.45, aggro: 16, ess: 2, scale: 1 },
      spitter: { hp: 24, spd: 2.5, dmg: 7, range: 11, aggro: 18, ess: 3, scale: 1 },
      wraith: { hp: 48, spd: 3.7, dmg: 12, range: 8, aggro: 20, ess: 6, scale: 1 },
      warden: { hp: 460, spd: 2.55, dmg: 20, range: 3.4, aggro: 42, ess: 80, scale: 1 },
      guard: { hp: 34, spd: 2.7, dmg: 7, range: 1.5, aggro: 13, ess: 3, scale: 1 },
      archer: { hp: 22, spd: 2.35, dmg: 6, range: 10, aggro: 15, ess: 3, scale: 1 },
      captain: { hp: 88, spd: 2.55, dmg: 12, range: 1.75, aggro: 16, ess: 10, scale: 1.18 }
    }[kind];
    const mesh = makeEnemyMesh(kind);
    const y = heightAt(x, z);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(def.scale || 1);
    scene.add(mesh);
    const e = {
      kind, mesh, x, y, z, hp: def.hp, maxHp: def.hp, spd: def.spd, dmg: def.dmg,
      range: def.range, aggro: def.aggro, ess: def.ess, atkCd: 0, wind: 0, slow: 0, hurt: 0, dead: false,
      scale: def.scale || 1
    };
    enemies.push(e);
    if (kind === "warden") {
      boss = e;
      G.wardenSpawned = true;
      $("boss-plate").classList.add("show");
      toast("雾狱守卫自石环中醒来");
    }
    return e;
  }

  function hurtPlayer(dmg, src) {
    if (G.iframes > 0 || G.hp <= 0) return;
    if (G.wardT > 0) dmg *= 0.45;
    dmg *= 1 - Math.min(0.5, networkBonus() * 0.5);
    dmg = Math.max(1, Math.round(dmg));
    G.hp -= dmg;
    G.iframes = 0.55;
    $("hurt").classList.add("on");
    setTimeout(() => $("hurt").classList.remove("on"), 140);
    floatText(playerGrp.position.x, playerGrp.position.y + 1.8, playerGrp.position.z, "-" + dmg);
    AudioSys.tone(90, 0.12, "sawtooth", 0.1);
    if (navigator.vibrate) navigator.vibrate(18);
    const dx = playerGrp.position.x - src.x, dz = playerGrp.position.z - src.z;
    const l = Math.hypot(dx, dz) || 1;
    G.vx += (dx / l) * 4;
    G.vz += (dz / l) * 4;
    if (G.hp <= 0) die();
  }

  function die() {
    G.hp = 0;
    $("dead-modal").classList.remove("hidden");
    G.paused = true;
    const dropMats = ["wood", "stone", "fiber", "crystal"];
    dropMats.forEach((id) => {
      const n = Math.floor(countItem(id) * (id === "crystal" ? 0.3 : 0.4));
      if (n > 0) takeItem(id, n);
    });
    updateRes();
  }

  function respawn() {
    $("dead-modal").classList.add("hidden");
    G.paused = false;
    G.hp = G.maxHp;
    G.stamina = 100;
    G.shroudLeft = shroudCap();
    playerGrp.position.set(altarPos.x, altarPos.y, altarPos.z + 2.5);
    G.iframes = 2;
    toast("禁忌符文将你唤回");
  }

  function killEnemy(e) {
    e.dead = true;
    emit(e.x, e.y + 1, e.z, 0x88ffaa, 16, 2.4);
    addItem("essence", e.ess);
    gainMana(4 + (isRune("power") ? 4 + runeLevel() : 0));
    gainRuneXP("kill", 2 + e.ess * 0.4);
    if (e.kind === "warden") {
      G.wardenDead = true;
      addItem("embercore", 1);
      addItem("crystal", 8);
      addItem("essence", 40);
      $("boss-plate").classList.remove("show");
      toast("雾狱守卫崩解，余烬核心入手");
      AudioSys.tone(140, 0.8, "sine", 0.18, 520);
    } else {
      if (Math.random() < 0.25) addItem("crystal", 1);
    }
    scene.remove(e.mesh);
    enemies = enemies.filter((x) => x !== e);
    if (boss === e) boss = null;
    if (e.site && !siteGuardsAlive(e.site)) {
      const s = sites.find((x) => x.id === e.site);
      if (s && s.owner !== "player") toast("驻军已溃，到旗帜处占领");
    }
    updateRes();
  }

  function hurtEnemy(e, dmg, magic) {
    if (e.dead) return;
    dmg = dmg * (G.markT > 0 ? 1.3 : 1);
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hurt = 0.12;
    floatText(e.x, e.y + (e.kind === "warden" ? 3.4 : 1.8), e.z, "" + dmg, magic ? "magic" : "");
    if (e.hp <= 0) killEnemy(e);
  }

  function staffDmg() {
    const tool = equippedTool();
    const tier = (tool && tool.tier) || 1;
    return (8 + tier * 4 + (G.flameLevel > 2 ? 3 : 0) + (G.gearAtk || 0)) * dmgMult();
  }

  function facingDir() {
    let best = null, bd = 16 * 16;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist2(playerGrp.position.x, playerGrp.position.z, e.x, e.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      const dx = best.x - playerGrp.position.x, dz = best.z - playerGrp.position.z;
      return { x: dx, z: dz, len: Math.hypot(dx, dz) };
    }
    return { x: Math.sin(G.facing), z: Math.cos(G.facing), len: 1 };
  }

  function spawnBolt(x, y, z, dx, dz, opt) {
    const l = Math.hypot(dx, dz) || 1;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(opt.size || 0.13, 6, 6),
      new THREE.MeshBasicMaterial({ color: opt.color, transparent: true, opacity: 0.95 })
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    bolts.push({
      mesh, x, y, z,
      vx: (dx / l) * opt.spd,
      vy: opt.vy || 0,
      vz: (dz / l) * opt.spd,
      life: opt.life, dmg: opt.dmg, friendly: opt.friendly, rad: opt.rad || 0.45, kind: opt.kind || "bolt"
    });
  }

  function castAtk() {
    useEquipment();
  }

  function ringFx(x, y, z, color, grow) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.7, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.2, z);
    ring.userData = { life: 0.45, grow: grow || 14 };
    fxGroup.add(ring);
  }

  function dropMeteor(tx, tz, dmg, radius, color) {
    const ty = heightAt(tx, tz);
    const mark = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.8, radius, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(tx, ty + 0.12, tz);
    fxGroup.add(mark);
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 0),
      new THREE.MeshLambertMaterial({ color: 0x3a2010, emissive: color, emissiveIntensity: 0.7 })
    );
    rock.position.set(tx, ty + 16, tz);
    fxGroup.add(rock);
    mark.userData = { meteor: true, rock, tx, ty, tz, t: 0, dmg, radius, color };
    AudioSys.tone(80, 0.4, "sawtooth", 0.12, 40);
  }

  function aimPoint(maxDist) {
    const d = facingDir();
    const l = Math.hypot(d.x, d.z) || 1;
    const dist = Math.min(maxDist, d.len || maxDist);
    return {
      x: playerGrp.position.x + (d.x / l) * dist,
      z: playerGrp.position.z + (d.z / l) * dist,
      dx: d.x / l, dz: d.z / l
    };
  }

  function castAbility(i) {
    if (G.paused || G.hp <= 0 || !G.running) return;
    const a = abilityDef(i);
    if (!a) return;
    const key = "a" + i;
    if (!abilityUnlocked(i)) {
      toast(a.name + "：需符文 " + a.lv + " 级");
      return;
    }
    if (G.cd[key] > 0) return;
    const lv = runeLevel();
    const px = playerGrp.position.x, pz = playerGrp.position.z, py = playerGrp.position.y;

    if (isRune("power")) {
      if (i === 0) {
        if (!spendMana(a.mana)) return;
        const dmg = (24 + lv * 6) * dmgMult();
        let hit = 0;
        for (const e of enemies) {
          if (Math.hypot(e.x - px, e.z - pz) < 4.4) { hurtEnemy(e, dmg, false); hit++; }
        }
        ringFx(px, py, pz, 0xff5a3a, 11);
        emit(px, py + 0.9, pz, 0xff5a3a, 18, 3);
        AudioSys.tone(200, 0.14, "sawtooth", 0.1, 90);
        swingT = 0.22;
        if (!hit) toast("裂击落空");
      } else if (i === 1) {
        if (G.stamina < 10) { toast("耐力不足"); return; }
        if (!spendMana(a.mana)) return;
        G.stamina -= 10;
        G.iframes = 0.42;
        const p = aimPoint(9);
        for (const e of enemies) {
          const t = sat(((e.x - px) * p.dx + (e.z - pz) * p.dz) / 9);
          const cx = px + p.dx * t * 9, cz = pz + p.dz * t * 9;
          if (Math.hypot(e.x - cx, e.z - cz) < 1.6) hurtEnemy(e, (18 + lv * 4) * dmgMult(), false);
        }
        if (!blocked(p.x, p.z, 0.4)) playerGrp.position.set(p.x, heightAt(p.x, p.z), p.z);
        emit(px, py + 1, pz, 0xffe07a, 14, 3);
        AudioSys.tone(140, 0.16, "sawtooth", 0.08, 60);
      } else if (i === 2) {
        const foe = nearestEnemy(9);
        if (!foe) { toast("附近没有可掠夺的目标"); return; }
        hurtEnemy(foe, (26 + lv * 7) * dmgMult(), true);
        gainMana(14 + lv * 2);
        heal(6 + lv);
        emit(foe.x, foe.y + 1.2, foe.z, 0xff5a3a, 16, 2.4);
        AudioSys.tone(320, 0.2, "square", 0.09, 120);
        toast("掠夺魔力");
      } else {
        if (!spendMana(a.mana)) return;
        const p = aimPoint(10);
        dropMeteor(p.x, p.z, (58 + lv * 12) * dmgMult(), 3.2, 0xff4a20);
      }
    } else if (isRune("golem")) {
      if (i === 0 || i === 2) {
        const kind = i === 0 ? "golem" : "wargolem";
        if (countMinions() >= minionCap()) { toast("麾下已达上限"); return; }
        const cost = i === 0 ? { wood: 4, stone: 4 } : { wood: 6, stone: 10, crystal: 1 };
        if (!canAfford(cost)) { toast("材料不足：" + (i === 0 ? "木4 石4" : "木6 石10 晶1")); return; }
        if (!spendMana(a.mana)) return;
        pay(cost);
        const m = spawnMinion(kind, px + 1.5, pz + 1.5, 1 + Math.floor(lv / 3));
        emit(m.x, m.y + 1, m.z, 0x9aa4b0, 16, 2.2);
        AudioSys.tone(220, 0.2, "square", 0.09, 320);
        toast(i === 0 ? "劳作傀儡启动" : "战斗傀儡启动");
      } else if (i === 1) {
        if (!spendMana(a.mana)) return;
        G.ordersT = 10;
        minions.forEach((m) => emit(m.x, m.y + 1, m.z, 0xff8a32, 6, 1.6));
        toast("铁令：傀儡与麾下加速");
        AudioSys.tone(300, 0.2, "square", 0.08);
      } else {
        if (!spendMana(a.mana)) return;
        minions.forEach((m, k) => {
          const a2 = (k / Math.max(1, minions.length)) * TAU;
          m.x = px + Math.cos(a2) * 2.2;
          m.z = pz + Math.sin(a2) * 2.2;
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.5);
          m.target = null;
          emit(m.x, m.y + 1, m.z, 0x9aa4b0, 8, 1.8);
        });
        ringFx(px, py, pz, 0x9aa4b0, 9);
        toast("集结完毕，已就地修复");
      }
    } else if (isRune("precision")) {
      if (i === 0) {
        if (!spendMana(a.mana)) return;
        G.markT = 8;
        const p = aimPoint(10);
        ringFx(p.x, heightAt(p.x, p.z), p.z, 0x7fd7ff, 16);
        for (const e of enemies) {
          if (Math.hypot(e.x - p.x, e.z - p.z) < 7) e.slow = Math.max(e.slow, 1.6);
        }
        toast("测算：敌方受创提升");
        AudioSys.tone(760, 0.16, "sine", 0.08, 420);
      } else if (i === 1) {
        if (!spendMana(a.mana)) return;
        G.rapidT = 14;
        toast("速筑：建造与打造耗材大减");
        AudioSys.tone(620, 0.18, "triangle", 0.09, 880);
        if (G.mode === "build") fillBuildTray();
      } else if (i === 2) {
        if (!spendMana(a.mana)) return;
        const p = aimPoint(6);
        const y = heightAt(p.x, p.z);
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.3, 6), new THREE.MeshLambertMaterial({ color: 0x6a645c }));
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshLambertMaterial({ color: 0x7fd7ff, emissive: 0x1a5a7a, emissiveIntensity: 0.7 }));
        barrel.position.y = 0.6;
        g.add(base, barrel);
        g.position.set(p.x, y + 0.2, p.z);
        scene.add(g);
        turrets.push({ mesh: g, x: p.x, y: y + 0.2, z: p.z, cd: 0.4, life: 22 + lv * 2 });
        toast("符阵炮台展开");
        AudioSys.tone(520, 0.2, "square", 0.08, 260);
      } else {
        if (!spendMana(a.mana)) return;
        G.overloadT = 9;
        buildings.forEach((b) => emit(b.x, b.y + 1.2, b.z, 0x7fd7ff, 6, 1.6));
        toast("超载：全部工事全速运转");
        AudioSys.tone(180, 0.4, "sawtooth", 0.1, 640);
      }
    } else {
      if (i === 0 || i === 3) {
        const n = i === 0 ? 1 : 2;
        if (countMinions() + n > minionCap()) { toast("麾下已达上限"); return; }
        if (!spendMana(a.mana)) return;
        for (let k = 0; k < n; k++) {
          const m = spawnMinion("life", px + 1.3 + k, pz + 1.3, 1 + Math.floor(lv / 3));
          emit(m.x, m.y + 1, m.z, 0x7ade8a, 16, 2.2);
        }
        gainRuneXP("heal", 2);
        AudioSys.tone(430, 0.22, "triangle", 0.1, 680);
        toast(n > 1 ? "群生：造物成群而出" : "生命造物出现");
      } else if (i === 1) {
        if (!spendMana(a.mana)) return;
        const amount = 26 + lv * 5;
        heal(amount);
        minions.forEach((m) => {
          m.hp = Math.min(m.maxHp, m.hp + amount);
          emit(m.x, m.y + 1, m.z, 0x7ade8a, 6, 1.6);
        });
        ringFx(px, py, pz, 0x7ade8a, 10);
        gainRuneXP("heal", 3);
        AudioSys.tone(560, 0.26, "sine", 0.1, 820);
        toast("疗愈");
      } else {
        if (!spendMana(a.mana)) return;
        G.networkT = 12;
        G.wardT = Math.max(G.wardT, 4);
        ringFx(px, py, pz, 0x7ade8a, 18);
        toast("生命网络张开：造物越多越难杀");
        AudioSys.tone(300, 0.4, "sine", 0.1, 520);
      }
    }
    G.cd[key] = a.cd;
  }

  function updateFx(dt) {
    const kill = [];
    fxGroup.children.forEach((o) => {
      if (o.userData.grow) {
        o.userData.life -= dt;
        o.scale.x += o.userData.grow * dt;
        o.scale.y += o.userData.grow * dt;
        o.material.opacity *= 0.92;
        if (o.userData.life <= 0) kill.push(o);
      } else if (o.userData.meteor) {
        o.userData.t += dt;
        const u = sat(o.userData.t / 1.05);
        o.userData.rock.position.y = lerp(o.userData.ty + 16, o.userData.ty + 0.6, u * u);
        o.userData.rock.rotation.x += dt * 4;
        if (u >= 1) {
          emit(o.userData.tx, o.userData.ty + 1, o.userData.tz, o.userData.color || 0xff5520, 28, 5);
          const rad = (o.userData.radius || 3.2) * 1.6;
          for (const e of enemies) {
            if (Math.hypot(e.x - o.userData.tx, e.z - o.userData.tz) < rad) {
              hurtEnemy(e, o.userData.dmg || 48, true);
            }
          }
          fxGroup.remove(o.userData.rock);
          kill.push(o);
        }
      }
    });
    kill.forEach((o) => fxGroup.remove(o));
  }

  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      let hit = false;
      if (b.friendly) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - b.x, e.z - b.z) < 0.7 + (e.kind === "warden" ? 0.8 : 0) && Math.abs(e.y + 1 - b.y) < 2.2) {
            hurtEnemy(e, b.dmg, true);
            hit = true;
            break;
          }
        }
      } else if (Math.hypot(playerGrp.position.x - b.x, playerGrp.position.z - b.z) < 0.7) {
        hurtPlayer(b.dmg, b);
        hit = true;
      } else {
        const m = nearestMinion(b.x, b.z, 0.75);
        if (m) {
          hurtMinion(m, b.dmg);
          hit = true;
        }
      }
      if (b.life <= 0 || hit || b.y < heightAt(b.x, b.z) - 0.2) {
        emit(b.x, b.y, b.z, b.friendly ? 0xff7a32 : 0x88ff66, 5, 1.5);
        scene.remove(b.mesh);
        bolts.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    const px = playerGrp.position.x, pz = playerGrp.position.z;
    const night = dayFactor() < 0.28;
    spawnAcc += dt;
    const roaming = enemies.filter((e) => !e.home && !e.dead).length;
    const cap = night ? 11 : 8;
    if (roaming < cap && spawnAcc > (night ? 1.8 : 2.6) && G.flameLit) {
      spawnAcc = 0;
      const a = rng() * TAU;
      const r = 16 + rng() * 16;
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const nearSite = sites.some((s) => Math.hypot(s.x - x, s.z - z) < 12);
      if (!nearSite && safeRadiusAt(x, z) <= 0 && shroudAt(x, z) && heightAt(x, z) > WATER + 0.5 && walkable(x, z, px, pz)) {
        const k = rng() < 0.18 ? "wraith" : rng() < 0.45 ? "spitter" : "crawler";
        spawnEnemy(k, x, z);
      }
    }
    if (!G.wardenSpawned && !G.wardenDead && G.flameLevel >= 2 && Math.hypot(px - G.bossPos.x, pz - G.bossPos.z) < 22) {
      spawnEnemy("warden", G.bossPos.x, G.bossPos.z);
    }

    for (const e of enemies.slice()) {
      if (e.dead) continue;
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.hurt = Math.max(0, e.hurt - dt);
      const pdist = Math.hypot(px - e.x, pz - e.z) || 0.001;
      const foeM = nearestMinion(e.x, e.z, Math.min(9, pdist + 3.5));
      const tgtX = foeM ? foeM.x : px;
      const tgtZ = foeM ? foeM.z : pz;
      const dx = tgtX - e.x, dz = tgtZ - e.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      e.mesh.position.y = heightAt(e.x, e.z) + (e.kind === "wraith" ? 0.45 + Math.sin(G.time * 2 + e.x) * 0.15 : 0);
      const sc = e.scale || (e.kind === "warden" ? 1.35 : 1);
      if (e.hurt > 0) e.mesh.scale.setScalar(sc * 1.08);
      else e.mesh.scale.setScalar(sc);
      if (pdist > 58 && e.kind !== "warden" && !e.home && !e.raid) {
        e.hp = 0;
        killEnemy(e);
        continue;
      }
      e.mesh.rotation.y = Math.atan2(dx, dz);
      const spd = e.spd * (e.slow > 0 ? 0.22 : 1) * (night && e.kind === "crawler" ? 1.15 : 1);
      if (e.home && pdist > e.aggro && !foeM) {
        const hx = e.home.x - e.x, hz = e.home.z - e.z;
        const hd = Math.hypot(hx, hz) || 1;
        if (hd > 0.6) {
          const pos = { x: e.x, z: e.z };
          moveWithSlide(pos, (hx / hd) * spd * dt, (hz / hd) * spd * dt, 0.4);
          e.x = pos.x; e.z = pos.z;
        }
      } else if (dist > e.range * 0.85) {
        const mx = (dx / dist) * spd * dt, mz = (dz / dist) * spd * dt;
        const ox = e.x, oz = e.z;
        if (e.kind === "wraith") {
          e.x += mx; e.z += mz;
        } else {
          const pos = { x: e.x, z: e.z };
          moveWithSlide(pos, mx, mz, e.kind === "warden" ? 0.9 : 0.4);
          e.x = pos.x; e.z = pos.z;
        }
        if (Math.hypot(e.x - ox, e.z - oz) < spd * dt * 0.25) {
          e.stuck = (e.stuck || 0) + dt;
          const sx = -(dz / dist), sz = dx / dist;
          const side = { x: e.x, z: e.z };
          moveWithSlide(side, sx * spd * dt * 1.4, sz * spd * dt * 1.4, 0.4);
          e.x = side.x; e.z = side.z;
          if (e.stuck > 5) {
            e.stuck = 0;
            const spot = raidSpot(px, pz, 12, 20);
            if (spot) { e.x = spot.x; e.z = spot.z; }
            else if (!e.home) { e.hp = 0; killEnemy(e); continue; }
          }
        } else e.stuck = 0;
      } else if (e.atkCd <= 0) {
        e.atkCd = e.kind === "spitter" || e.kind === "archer" ? 1.6 : e.kind === "warden" ? 2.1 : 1.25;
        if (e.kind === "spitter" || e.kind === "wraith" || e.kind === "archer") {
          spawnBolt(e.x, e.y + 1.2, e.z, dx, dz, {
            spd: e.kind === "wraith" ? 13 : 11, life: 2, dmg: e.dmg, friendly: false,
            color: e.kind === "wraith" ? 0x6688ff : e.kind === "archer" ? 0xc4b494 : 0x88ff44, size: 0.16
          });
        } else if (dist < e.range + 0.4) {
          if (foeM) hurtMinion(foeM, e.dmg);
          else hurtPlayer(e.dmg, e);
        }
        if (e.kind === "warden" && e.hp < e.maxHp * 0.55 && rng() < 0.35) {
          const a = rng() * TAU;
          spawnEnemy("crawler", e.x + Math.cos(a) * 5, e.z + Math.sin(a) * 5);
        }
      }
      e.mesh.position.x = e.x;
      e.mesh.position.z = e.z;
      e.y = e.mesh.position.y;
      for (const b of buildings) {
        if (b.spike && Math.hypot(e.x - b.x, e.z - b.z) < 1.3) {
          e.hp -= 14 * dt;
          if (e.hp <= 0) killEnemy(e);
        }
      }
    }
    if (boss && !boss.dead) {
      $("boss-hp").style.width = (100 * boss.hp / boss.maxHp) + "%";
    }
  }

  function dayFactor() {
    const t = (G.day % 1);
    return Math.max(0, Math.sin(t * TAU));
  }

  function walkable(x, z, tx, tz) {
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (heightAt(lerp(x, tx, t), lerp(z, tz, t)) < WATER + 0.35) return false;
    }
    return true;
  }

  function raidSpot(cx, cz, minR, maxR) {
    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU;
      const r = minR + rng() * (maxR - minR);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (heightAt(x, z) < WATER + 0.6) continue;
      if (safeRadiusAt(x, z) > 0) continue;
      if (!walkable(x, z, cx, cz)) continue;
      return { x, z };
    }
    return null;
  }

  function startRaid() {
    const nights = Math.max(1, Math.floor(G.day));
    const n = Math.min(10, 2 + nights + capturedCount());
    const cx = playerGrp.position.x, cz = playerGrp.position.z;
    let spawned = 0;
    for (let i = 0; i < n && spawned < n; i++) {
      const spot = raidSpot(cx, cz, 20, 30);
      if (!spot) continue;
      const k = rng() < 0.2 ? "wraith" : rng() < 0.5 ? "spitter" : "crawler";
      const e = spawnEnemy(k, spot.x, spot.z);
      e.raid = true;
      e.aggro = 90;
      spawned++;
    }
    if (spawned) {
      toast("入夜：腐化之物涌向你的营地（" + spawned + "）");
      AudioSys.tone(70, 0.9, "sawtooth", 0.12, 40);
    }
  }

  function updateRaids(dt) {
    const df = dayFactor();
    const night = df < 0.2;
    if (night && !lastNight) {
      lastNight = true;
      raidT = 0;
      if (G.flameLit) startRaid();
    } else if (!night && lastNight) {
      lastNight = false;
    }
    if (!G.day1Warned && df < 0.45 && G.day % 1 > 0.35) {
      G.day1Warned = true;
      toast("天要黑了。造一座火塔，或备好杀法");
    }
    if (night && G.flameLit) {
      raidT += dt;
      if (raidT > 46) {
        raidT = 0;
        startRaid();
      }
    }
  }

  function updateDay(dt) {
    G.day += dt / 420;
    const df = Math.max(0, Math.sin((G.day % 1) * TAU));
    const dusk = new THREE.Color(0xffc08a);
    const dayc = new THREE.Color(0xfff2d4);
    const nightc = new THREE.Color(0x6a88cc);
    const sunCol = df > 0.15 ? dayc.clone().lerp(dusk, sat(1 - Math.abs(df - 0.6) * 2)) : nightc;
    sun.color.copy(sunCol);
    sun.intensity = 0.28 + df * 1.0;
    hemi.intensity = 0.4 + df * 0.5;
    const ang = G.day * TAU;
    sun.position.set(playerGrp.position.x + Math.cos(ang) * 50, 18 + df * 55, playerGrp.position.z + Math.sin(ang) * 30);
    sun.target.position.copy(playerGrp.position);
    const fogDay = new THREE.Color(0x8aa7c4);
    const fogNight = new THREE.Color(0x0c1018);
    const fogShroud = new THREE.Color(0x1a1230);
    const fog = fogDay.clone().lerp(fogNight, 1 - df);
    if (G.inShroud) fog.lerp(fogShroud, 0.55);
    scene.fog.color.copy(fog);
    scene.background.copy(fog.clone().lerp(new THREE.Color(df > 0.2 ? 0x87a8c4 : 0x0a1020), 0.35));
    const sky = scene.getObjectByName("sky");
    if (sky) sky.material.color.copy(scene.background);
  }

  function updatePlayer(dt) {
    let ix = joy.x, iy = joy.y;
    if (keys["KeyW"] || keys["ArrowUp"]) iy += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) iy -= 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) ix -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) ix += 1;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const sprint = (keys["ShiftLeft"] || keys["ShiftRight"]) && G.stamina > 2;
    const spd = (sprint ? 8.4 : 5.6) * (1 + 0.035 * runeStep("power"));
    if (sprint && il > 0.2) G.stamina = Math.max(0, G.stamina - 18 * dt);
    else G.stamina = Math.min(100, G.stamina + 14 * dt);
    const wishX = (rx * ix + fx * iy) * spd;
    const wishZ = (rz * ix + fz * iy) * spd;
    G.vx = lerp(G.vx, wishX, 1 - Math.pow(0.001, dt));
    G.vz = lerp(G.vz, wishZ, 1 - Math.pow(0.001, dt));
    const pos = { x: playerGrp.position.x, z: playerGrp.position.z };
    moveWithSlide(pos, G.vx * dt, G.vz * dt, 0.38);
    playerGrp.position.x = pos.x;
    playerGrp.position.z = pos.z;
    const h = heightAt(pos.x, pos.z);
    const bob = il > 0.15 ? Math.sin(G.time * 9) * 0.05 : 0;
    playerGrp.position.y = h + bob;
    if (il > 0.15) G.facing = Math.atan2(G.vx, G.vz);
    playerGrp.rotation.y = G.facing;
    cloak.rotation.x = il * 0.25;
    G.iframes = Math.max(0, G.iframes - dt);
    G.wardT = Math.max(0, G.wardT - dt);
    if (G.wardT > 0) {
      staffLight.color.set(0xffe08a);
      staffLight.intensity = 1.4;
    } else {
      staffLight.color.setHex(runeColor());
      staffLight.intensity = G.equip === "staff" ? 0.65 : 0;
    }
    if (swingT > 0) {
      swingT -= dt;
      const k = Math.sin(sat(1 - swingT / 0.22) * Math.PI);
      if (weaponRoot) weaponRoot.rotation.x = -k * 1.15;
    } else if (weaponRoot) weaponRoot.rotation.x = 0;
    wrongToastT = Math.max(0, wrongToastT - dt);
    if ((atkHeld || keys.Space) && G.cd.atk <= 0) useEquipment();
    updateAimAssist();

    G.inShroud = shroudAt(pos.x, pos.z);
    const bar = $("sh-bar");
    if (G.inShroud) {
      bar.classList.add("show");
      $("hurt").classList.add("shroud");
      G.shroudLeft -= dt * (dayFactor() < 0.25 ? 1.35 : 1);
      if (G.buffShroud > 0) {
        G.buffShroud -= dt;
        G.shroudLeft += dt * 0.65;
      }
      if (G.shroudLeft <= 0) {
        G.shroudLeft = 0;
        if (G.time * 3 % 1 < dt * 3) hurtPlayer(6, { x: pos.x, z: pos.z });
      }
    } else {
      bar.classList.remove("show");
      $("hurt").classList.remove("shroud");
      G.shroudLeft = Math.min(shroudCap(), G.shroudLeft + dt * 3.5);
    }

    for (const k of Object.keys(G.cd)) G.cd[k] = Math.max(0, G.cd[k] - dt);
    G.mana = Math.min(G.maxMana, G.mana + dt * (2.4 + runeLevel() * 0.3));
    G.ordersT = Math.max(0, G.ordersT - dt);
    G.rapidT = Math.max(0, G.rapidT - dt);
    G.networkT = Math.max(0, G.networkT - dt);
    G.markT = Math.max(0, G.markT - dt);
    G.overloadT = Math.max(0, G.overloadT - dt);
    const safe = safeRadiusAt(pos.x, pos.z);
    if (safe > 0) G.shroudLeft = Math.min(shroudCap(), G.shroudLeft + dt * 2.5 * safe);
    if (G.hp < G.maxHp && !G.inShroud) {
      regenAcc += dt * (isRune("life") ? 0.3 + 0.16 * runeStep("life") : 0.06) * (1 + safe);
      if (regenAcc >= 1) {
        const n = Math.floor(regenAcc);
        regenAcc -= n;
        G.hp = Math.min(G.maxHp, G.hp + n);
      }
    }

    if (G.mode === "build" && ghost) {
      const p = ghostPos();
      ghost.position.set(p.x, p.y + pieceDef(ghostType).y, p.z);
      ghost.rotation.y = ghostRot * Math.PI * 0.5;
      const ok = canPlace(p.x, p.z, ghostType);
      ghost.traverse((o) => {
        if (o.material) o.material.color.set(ok ? 0x88ffaa : 0xff6655);
      });
    }
  }

  function updateCamera(dt) {
    const px = playerGrp.position.x, py = playerGrp.position.y, pz = playerGrp.position.z;
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const tx = px + Math.sin(camYaw) * camDist * cp;
    const ty = py + camDist * sp + 1.4;
    const tz = pz + Math.cos(camYaw) * camDist * cp;
    camera.position.lerp(TMP.v2.set(tx, ty, tz), 1 - Math.pow(0.0008, dt));
    camera.lookAt(px, py + 1.15, pz);
    if (joy.on) {
      $("knob").style.transform = `translate(${joy.x * 34}px, ${-joy.y * 34}px)`;
    } else {
      $("knob").style.transform = "translate(0,0)";
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 4 * dt;
      const d = TMP.dummy;
      d.position.set(p.x, p.y, p.z);
      d.scale.setScalar(p.life > 0 ? p.s * sat(p.life * 2) : 0.001);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      particleIM.setMatrixAt(p.i, d.matrix);
    }
    particleIM.instanceMatrix.needsUpdate = true;
  }

  function updateUI() {
    $("hp-fill").style.width = (100 * G.hp / G.maxHp) + "%";
    $("mp-fill").style.width = (100 * G.mana / G.maxMana) + "%";
    $("st-fill").style.width = G.stamina + "%";
    $("sh-fill").style.width = (100 * G.shroudLeft / Math.max(1, shroudCap() + G.buffShroud)) + "%";
    $("hp-lab").textContent = Math.ceil(G.hp) + " / " + G.maxHp;
    $("mp-lab").textContent = Math.ceil(G.mana) + " / " + G.maxMana;
    const lv = runeLevel();
    $("rune-name").textContent = runeDef().name;
    $("rune-lv").textContent = "Lv" + lv;
    const xpNow = G.runeXP - runeXPForLevel(lv);
    const xpNeed = Math.max(1, runeXPForLevel(lv + 1) - runeXPForLevel(lv));
    $("rune-xp").style.width = sat(xpNow / xpNeed) * 100 + "%";
    for (let i = 0; i < 4; i++) {
      const el = $("sk-" + i);
      const a = abilityDef(i);
      if (!el || !a) continue;
      el.querySelector(".cd").style.setProperty("--p", (100 * G.cd["a" + i] / a.cd) + "%");
    }
    interact = getInteract();
    const act = $("act");
    if (interact && G.mode === "play") {
      act.textContent = interact.label;
      act.classList.add("show");
    } else act.classList.remove("show");
    const q = [
      { t: "挥斧取 8 木材，在祭坛点燃流放者的火种", ok: G.flameLit },
      { t: "造一座火塔（建造模式），夜里才有安全地", ok: buildings.some((b) => b.id === "firetower") },
      { t: "攻占一处地盘（小地图褐色方块）", ok: capturedCount() >= 1 },
      { t: "在已占领的旗帜下招募麾下", ok: countMinions("follower") >= 1 },
      { t: "把符文练到 3 级，解锁第三个技能", ok: runeLevel() >= 3 },
      { t: "再占领一处地盘，打开故土渡口", ok: capturedCount() >= 2 },
      { t: "攻占北境「故土渡口」", ok: siteOwned("gate") },
      { t: "击败北境石环的雾狱守卫", ok: G.wardenDead },
      { t: "将祭坛火焰升至圆满", ok: G.flameLevel >= 4 }
    ];
    const cur = q.find((x) => !x.ok) || { t: "渡口已在你手。招兵、筑城，择日反攻故土。" };
    $("quest-text").textContent = cur.t;
    if (toastT > 0) {
      toastT -= 0.016;
      if (toastT <= 0) $("toast").classList.remove("show");
    }
  }

  function updateRes() {
    $("r-wood").textContent = countItem("wood");
    $("r-stone").textContent = countItem("stone");
    $("r-fiber").textContent = countItem("fiber");
    $("r-crystal").textContent = countItem("crystal");
    $("r-essence").textContent = countItem("essence");
    const ember = $("r-ember");
    if (ember) ember.textContent = countItem("embercore");
  }

  function openCraft() {
    closeBag();
    const bench = nearBench();
    const note = $("craft-note");
    if (note) {
      note.textContent = bench
        ? ("工坊已就绪，可打造全部配方。" + (craftDiscount() > 0 ? "（精密符文减耗 " + Math.round(craftDiscount() * 100) + "%）" : ""))
        : "未在工坊旁：只能缝风帽、背心，以及做绷带和干粮。";
    }
    document.querySelectorAll("#craft-tabs .tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === craftTab));
    const grid = $("craft-grid");
    grid.innerHTML = "";
    const names = { wood: "木", stone: "石", fiber: "纤", crystal: "晶", essence: "魂", embercore: "核" };
    RECIPES.filter((r) => r.tab === craftTab).forEach((r) => {
      const cost = scaleCost(recipeCost(r));
      const b = document.createElement("button");
      b.className = "card";
      b.dataset.ui = "1";
      const parts = Object.entries(cost).filter(([, v]) => v).map(([k, v]) => names[k] + v).join(" · ");
      const lock = (r.bench && !bench) ? "需工坊" : ((r.flame || 0) > G.flameLevel ? ("需火焰 " + r.flame) : "");
      b.innerHTML = `<b>${r.name}</b><span>${r.desc}<br/>${parts}${lock ? "<br/>" + lock : ""}</span>`;
      b.disabled = !canAfford(cost) || (r.bench && !bench) || (r.flame || 0) > G.flameLevel;
      b.onclick = () => {
        if (r.bench && !nearBench()) { toast("需要靠近工坊"); return; }
        if ((r.flame || 0) > G.flameLevel) { toast("火焰等级不足"); return; }
        if (!canAfford(cost)) { toast("材料不足"); return; }
        pay(cost);
        if (!addItem(r.out, r.outN || 1)) {
          refund(cost, 1);
          toast("背包满了，打造取消");
          return;
        }
        gainRuneXP("craft", 2.5);
        toast("打造完成：" + (ITEMS[r.out] ? ITEMS[r.out].name : r.name));
        AudioSys.tone(300, 0.12, "triangle", 0.08);
        openCraft();
      };
      grid.appendChild(b);
    });
    $("craft-modal").classList.remove("hidden");
    refreshPause();
  }

  function save() {
    const data = {
      seed: G.seed,
      time: G.time,
      day: G.day,
      hp: G.hp,
      stamina: G.stamina,
      shroudLeft: G.shroudLeft,
      staff: G.staff,
      flameLevel: G.flameLevel,
      flameLit: G.flameLit,
      inv: invSnapshot(),
      bag: G.bag,
      hotbar: G.hotbar,
      paper: G.paper,
      equipSlot: G.equipSlot,
      mana: G.mana,
      rune: G.rune,
      runeXP: G.runeXP,
      cores: G.cores,
      sites: Object.fromEntries(sites.map((s) => [s.id, s.owner])),
      minions: minions.map((m) => ({ kind: m.kind, lv: m.lv })),
      followerN: countMinions("follower"),
      wardenDead: G.wardenDead,
      quality: G.quality,
      audioOn: G.audioOn,
      equip: G.equip,
      pos: playerGrp ? [playerGrp.position.x, playerGrp.position.y, playerGrp.position.z] : null,
      facing: G.facing,
      camYaw, camDist,
      trees: trees.filter((t) => !t.alive).map((t) => t.i),
      rocks: rocks.filter((t) => !t.alive).map((t) => t.i),
      bushes: bushes.filter((t) => !t.alive).map((t) => t.i),
      crystals: crystals.filter((t) => !t.alive).map((t) => t.i),
      buildings: buildings.map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, rot: b.rot }))
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) { /* private mode */ }
  }

  function hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  function applySave(data) {
    applyInventory(data);
    G.hp = data.hp ?? 100;
    G.stamina = data.stamina ?? 100;
    G.rune = RUNES[data.rune] ? data.rune : "power";
    G.runeXP = data.runeXP || 0;
    G.cores = Array.isArray(data.cores) ? data.cores.slice() : [];
    G.sites = data.sites || {};
    G.followerN = data.followerN || 0;
    G.savedMinions = Array.isArray(data.minions) ? data.minions : null;
    sites.forEach((s) => {
      s.owner = G.sites[s.id] === "player" ? "player" : "enemy";
      paintSite(s);
    });
    G.wardenDead = !!data.wardenDead;
    G.day = data.day || 0.31;
    G.time = data.time || 0;
    G.facing = data.facing || 0;
    camYaw = data.camYaw ?? camYaw;
    camDist = data.camDist ?? camDist;
    if (data.quality) applyQuality(data.quality, true);
    setFlameLevel(data.flameLevel || 0, !!data.flameLit);
    applyGear();
    applyRune(G.rune, true);
    if (G.hp > G.maxHp) G.hp = G.maxHp;
    G.mana = Math.min(G.maxMana, data.mana ?? G.maxMana);
    G.shroudLeft = data.shroudLeft ?? shroudCap();
    if (data.pos) playerGrp.position.set(data.pos[0], data.pos[1], data.pos[2]);
    (data.trees || []).forEach((i) => { const t = trees[i]; if (t) { t.alive = false; hideInstance(treeIM, t.i); hideInstance(leafIM, t.i); } });
    (data.rocks || []).forEach((i) => { const t = rocks[i]; if (t) { t.alive = false; hideInstance(rockIM, t.i); } });
    (data.bushes || []).forEach((i) => { const t = bushes[i]; if (t) { t.alive = false; hideInstance(bushIM, t.i); } });
    (data.crystals || []).forEach((i) => { const t = crystals[i]; if (t) { t.alive = false; hideInstance(cryIM, t.i); } });
    (data.buildings || []).forEach((b) => {
      addBuilding(b.id, b.x, b.y, b.z, b.rot || 0);
    });
    syncAbilityBar();
    updateRes();
    fillHotbar();
    setEquipSlot(G.equipSlot, true);
  }

  function clearWorld() {
    while (scene.children.length) scene.remove(scene.children[0]);
    buildings = [];
    sites = [];
    minions = [];
    turrets = [];
    enemies = [];
    bolts = [];
    boss = null;
    G.wardenSpawned = false;
  }

  function startGame(cont) {
    AudioSys.init();
    if (!scene) setupRenderer();
    else clearWorld();
    const data = cont ? JSON.parse(localStorage.getItem(SAVE_KEY) || "null") : null;
    G.seed = (data && data.seed) || ((Math.random() * 1e9) | 0);
    if (!cont) {
      G.hp = 100; G.stamina = 100; G.staff = 1;
      G.flameLit = false; G.flameLevel = 0; G.wardenDead = false;
      G.day = 0.34; G.time = 0;
      G.buffShroud = 0;
      G.rune = chosenRune;
      G.runeXP = 0;
      G.cores = [];
      G.sites = {};
      G.followerN = 0;
      G.savedMinions = null;
      G.day1Warned = false;
      G.ordersT = G.rapidT = G.networkT = G.markT = G.overloadT = 0;
      tutorialStep = 0;
      tributeAcc = 0;
      raidT = 0;
      lastNight = false;
      starterLoadout();
      applyGear();
      G.mana = G.maxMana;
    }
    scene.add(hemi); scene.add(sun); scene.add(sun.target); scene.add(fxGroup);
    if (G.amb) scene.add(G.amb);
    if (!fxGroup.parent) scene.add(fxGroup);
    if (cont && data) {
      G.rune = RUNES[data.rune] ? data.rune : "power";
      G.sites = data.sites || {};
      G.followerN = data.followerN || 0;
    }
    generateWorld(G.seed);
    makeMage();
    applyRune(G.rune || chosenRune, true);
    setFlameLevel(0, false);
    if (data && cont) applySave(data);
    else {
      playerGrp.position.set(spawn.x + 5.2, spawn.y, spawn.z + 4.4);
      setFlameLevel(0, false);
      applyRune(G.rune, true);
    }
    populateSiteGuards();
    if (G.savedMinions && G.savedMinions.length) {
      const list = G.savedMinions;
      G.savedMinions = null;
      list.forEach((m, i) => {
        spawnMinion(MINIONS[m.kind] ? m.kind : "follower",
          playerGrp.position.x + 1.2 + i * 0.7, playerGrp.position.z + 1.4, m.lv || 1);
      });
    } else {
      restoreMinions(G.followerN || 0);
    }
    camera.position.set(playerGrp.position.x + 8, playerGrp.position.y + 20, playerGrp.position.z + 16);
    camera.lookAt(playerGrp.position.x, playerGrp.position.y + 1, playerGrp.position.z);
    $("boot").classList.add("hidden");
    $("hud").classList.remove("hidden");
    G.running = true;
    G.paused = false;
    updateRes();
    syncAbilityBar();
    fillBuildTray();
    fillHotbar();
    setEquipSlot(G.equipSlot, true);
    applyGear();
    toast(cont ? "旅途继续" : ("「" + runeDef().name + "」已铭刻。点燃火种，再造一座火塔"));
    drawMinimap();
    if (!G.loopStarted) {
      G.loopStarted = true;
      clock.getDelta();
      loop();
    }
    save();
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    if (!G.running) return;
    if (waterMesh && waterMesh.material.userData.shader) waterMesh.material.userData.shader.uniforms.uTime.value = G.time;
    if (shroudUniforms) shroudUniforms.uTime.value = G.time;
    if (G.paused) {
      renderer.render(scene, camera);
      return;
    }
    G.time += dt;
    updatePlayer(dt);
    updateEnemies(dt);
    updateRaids(dt);
    updateMinions(dt);
    updateStructures(dt);
    updateTribute(dt);
    updateBolts(dt);
    updateFx(dt);
    updateParticles(dt);
    updateDay(dt);
    updateCamera(dt);
    updateUI();
    if ((G.time * 4 | 0) !== ((G.time - dt) * 4 | 0)) drawMinimap();
    saveAcc += dt;
    if (saveAcc > 7) { saveAcc = 0; save(); }
    if (tutorialStep === 0 && G.time > 2.4) { tutorialStep = 1; toast("切到手斧，按住攻击轮盘劈树"); }
    if (tutorialStep === 1 && countItem("wood") >= 2) { tutorialStep = 2; toast("木材够了就回到祭坛点燃火种"); }
    if (tutorialStep === 2 && G.flameLit) { tutorialStep = 3; toast("按建造，放一座火塔：夜里它是你的安全地"); }
    if (tutorialStep === 3 && buildings.some((b) => b.id === "firetower")) {
      tutorialStep = 4;
      toast("小地图褐色方块是其它势力的城寨，清掉驻军可占领");
    }
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  function pointerDown(e) {
    if (e.target.closest("[data-ui]")) {
      if (e.target.closest("#joy")) {
        const r = $("joy").getBoundingClientRect();
        joy.on = true; joy.id = e.pointerId;
        joy.ox = r.left + r.width / 2;
        joy.oy = r.top + r.height / 2;
        pointerMove(e);
        e.target.setPointerCapture?.(e.pointerId);
      }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const arr = [...pointers.values()];
      pinch0 = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      return;
    }
    const left = e.clientX < innerWidth * 0.46;
    if (left && !joy.on && e.pointerType !== "mouse") {
      joy.on = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
      $("joy").style.left = (e.clientX - 64) + "px";
      $("joy").style.bottom = "auto";
      $("joy").style.top = (e.clientY - 64) + "px";
    } else {
      look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
    }
  }
  function pointerMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch0) {
      const arr = [...pointers.values()];
      const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      camDist = clamp(camDist * (pinch0 / d), 12, 38);
      pinch0 = d;
      return;
    }
    if (joy.on && e.pointerId === joy.id) {
      const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
      const m = 52;
      const l = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, l / m);
      joy.x = (dx / l) * k;
      joy.y = (-dy / l) * k;
      return;
    }
    if (look.id === e.pointerId) {
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      camYaw -= dx * 0.0075;
      camPitch = clamp(camPitch + dy * 0.004, 0.72, 1.35);
      look.x = e.clientX; look.y = e.clientY;
    }
  }
  function pointerUp(e) {
    pointers.delete(e.pointerId);
    if (e.pointerId === joy.id) {
      joy.on = false; joy.id = null; joy.x = 0; joy.y = 0;
      $("joy").style.left = "";
      $("joy").style.top = "";
      $("joy").style.bottom = "";
    }
    if (e.pointerId === look.id) look.id = null;
    atkHeld = false;
  }

  function fillRuneGrid() {
    const grid = $("rune-grid");
    if (!grid) return;
    grid.innerHTML = "";
    Object.values(RUNES).forEach((r) => {
      const b = document.createElement("button");
      b.className = "rune-card" + (chosenRune === r.id ? " on" : "");
      b.dataset.ui = "1";
      const skills = r.abil.map((a) => a.name + "(" + a.lv + "级)").join(" · ");
      const grow = { power: "杀敌", golem: "傀儡劳作", precision: "打造与建造", life: "治疗与造物" }[r.id];
      b.innerHTML = "<b>" + r.name + "</b><span>" + r.desc +
        "<br/><em>符文经验来自：" + grow + "</em><br/><em>技能：" + skills + "</em></span>";
      b.onclick = () => {
        chosenRune = r.id;
        fillRuneGrid();
      };
      grid.appendChild(b);
    });
  }
  function showRunePick() {
    $("boot-home").classList.add("hidden");
    $("rune-pick").classList.remove("hidden");
    fillRuneGrid();
  }
  function hideRunePick() {
    $("rune-pick").classList.add("hidden");
    $("boot-home").classList.remove("hidden");
  }

  function bind() {
    window.addEventListener("resize", onResize);
    window.addEventListener("touchmove", (e) => {
      if (e.target.closest(".sheet") || e.target.closest(".build-row")) return;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener("pointerdown", pointerDown, { passive: false });
    window.addEventListener("pointermove", pointerMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (!G.running) return;
      if (e.code === "Space") { e.preventDefault(); if (!G.paused) useEquipment(); }
      if (e.code === "Digit1") setEquipSlot(0);
      if (e.code === "Digit2") setEquipSlot(1);
      if (e.code === "Digit3") setEquipSlot(2);
      if (e.code === "Digit4") setEquipSlot(3);
      if (e.code === "KeyE" && !G.paused) doInteract();
      if (e.code === "KeyB" && !G.paused) toggleBuild();
      if (e.code === "KeyI") {
        if ($("bag-modal") && !$("bag-modal").classList.contains("hidden")) closeBag();
        else openBag();
      }
      if (e.code === "KeyC") {
        if ($("craft-modal") && !$("craft-modal").classList.contains("hidden")) closeCraft();
        else openCraft();
      }
      if (e.code === "KeyQ") castAbility(0);
      if (e.code === "KeyZ") castAbility(1);
      if (e.code === "KeyV") castAbility(2);
      if (e.code === "KeyG") castAbility(3);
      if (e.code === "KeyR" && G.mode === "build") ghostRot = (ghostRot + 1) % 4;
      if (e.code === "KeyF" && G.mode === "build") placeBuilding();
      if (e.code === "KeyX" && G.mode === "build") removeBuilding();
      if (e.code === "Escape") {
        if ($("bag-modal") && !$("bag-modal").classList.contains("hidden")) closeBag();
        else if ($("craft-modal") && !$("craft-modal").classList.contains("hidden")) closeCraft();
        else toggleMenu();
      }
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
    window.addEventListener("wheel", (e) => {
      camDist = clamp(camDist + e.deltaY * 0.02, 12, 38);
    }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

    $("btn-new").onclick = showRunePick;
    $("btn-rune-go").onclick = () => startGame(false);
    $("btn-rune-back").onclick = hideRunePick;
    $("btn-continue").onclick = () => startGame(true);
    const atkBtn = $("btn-atk");
    atkBtn.onpointerdown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      atkHeld = true;
      useEquipment();
    };
    atkBtn.onpointerup = () => { atkHeld = false; };
    atkBtn.onpointercancel = () => { atkHeld = false; };
    atkBtn.onclick = (e) => e.preventDefault();
    for (let i = 0; i < 4; i++) {
      const el = $("sk-" + i);
      if (el) el.onclick = () => castAbility(i);
    }
    $("act").onclick = doInteract;
    $("btn-bag").onclick = () => {
      if ($("bag-modal").classList.contains("hidden")) openBag();
      else closeBag();
    };
    $("btn-bag-equip").onclick = bagActionEquip;
    $("btn-bag-use").onclick = () => useFromBag(selectedBag);
    $("btn-bag-drop").onclick = () => dropFromBag(selectedBag);
    $("btn-bag-close").onclick = closeBag;
    $("btn-build").onclick = toggleBuild;
    $("btn-craft").onclick = openCraft;
    $("btn-menu").onclick = toggleMenu;
    document.querySelectorAll("#craft-tabs .tab").forEach((t) => {
      t.onclick = () => { craftTab = t.dataset.tab; openCraft(); };
    });
    $("btn-build-close").onclick = () => { if (G.mode === "build") toggleBuild(); };
    $("btn-place").onclick = placeBuilding;
    $("btn-rot").onclick = () => { ghostRot = (ghostRot + 1) % 4; };
    $("btn-remove").onclick = removeBuilding;
    $("btn-craft-close").onclick = closeCraft;
    $("btn-menu-close").onclick = () => { $("menu-modal").classList.add("hidden"); refreshPause(); };
    $("btn-save").onclick = () => { save(); toast("已写入本地记忆"); };
    $("btn-respawn").onclick = respawn;
    $("btn-quality").onclick = () => {
      const o = { low: "med", med: "high", high: "low" };
      applyQuality(o[G.quality]);
    };
    $("btn-audio").onclick = () => {
      AudioSys.setOn(!G.audioOn);
      $("btn-audio").textContent = "音效：" + (G.audioOn ? "开" : "关");
    };
    $("btn-reset").onclick = () => {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    };
    $("craft-modal").addEventListener("click", (e) => {
      if (e.target.id === "craft-modal") closeCraft();
    });
    $("bag-modal").addEventListener("click", (e) => {
      if (e.target.id === "bag-modal") closeBag();
    });
  }

  function toggleBuild() {
    if (G.mode === "build") {
      G.mode = "play";
      $("build-tray").classList.remove("open");
      $("btn-build").classList.remove("on");
      if (ghost) { scene.remove(ghost); ghost = null; }
    } else {
      G.mode = "build";
      $("build-tray").classList.add("open");
      $("btn-build").classList.add("on");
      fillBuildTray();
      rebuildGhost();
      toast("建造：整栋放置。先来一座火塔");
    }
  }

  function toggleMenu() {
    const m = $("menu-modal");
    const open = m.classList.contains("hidden");
    m.classList.toggle("hidden", !open);
    if (open) $("btn-audio").textContent = "音效：" + (G.audioOn ? "开" : "关");
    refreshPause();
  }

  function boot() {
    window.addEventListener("error", (e) => {
      console.error("[mistfire]", e.message, e.filename, e.lineno);
    });
    bind();
    if (hasSave()) $("btn-continue").classList.remove("hidden");
    if (location.protocol.startsWith("http") && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    if (/[?&]autostart/.test(location.search)) {
      setTimeout(() => startGame(false), 80);
    }
    if (/[?&]dev/.test(location.search)) {
      window.DEV = {
        give(n) {
          const k = n || 60;
          ["wood", "stone", "fiber", "crystal", "essence"].forEach((id) => addItem(id, k));
          return "ok";
        },
        xp(n) { gainRuneXP(runeDef().xp[0], n || 100); return G.runeXP; },
        raid() { startRaid(); return enemies.length; },
        slay() {
          const m = minions[0];
          if (!m) return "no minion";
          hurtMinion(m, m.maxHp * 10);
          return G.cores.slice();
        },
        night() { G.day = Math.floor(G.day) + 0.78; return G.day; },
        rune(id) { applyRune(id); return G.rune; },
        nocd() { Object.keys(G.cd).forEach((k) => { G.cd[k] = 0; }); return "ok"; },
        tp(where) {
          let x = altarPos.x + 2.4, z = altarPos.z + 1.4;
          if (where && where !== "altar") {
            const s = sites.find((q) => (where === "mine" ? q.owner === "player" : q.owner !== "player" && !q.need));
            if (s) { x = s.x + 2.2; z = s.z + 2.2; }
          }
          playerGrp.position.set(x, heightAt(x, z), z);
          return { x: Math.round(x), z: Math.round(z) };
        },
        dump() {
          const px = playerGrp.position.x, pz = playerGrp.position.z;
          return {
            hp: Math.round(G.hp), paused: G.paused, day: +G.day.toFixed(2),
            safe: +safeRadiusAt(px, pz).toFixed(2),
            near: enemies
              .map((e) => ({
                k: e.kind, d: +Math.hypot(e.x - px, e.z - pz).toFixed(1),
                hp: Math.round(e.hp), home: !!e.home, raid: !!e.raid
              }))
              .sort((a, b) => a.d - b.d).slice(0, 6)
          };
        },
        state() {
          return {
            rune: G.rune, lv: runeLevel(), xp: G.runeXP, mana: Math.round(G.mana),
            flame: G.flameLevel + (G.flameLit ? " lit" : " dark"),
            tributeAcc: +tributeAcc.toFixed(1),
            sites: sites.map((s) => s.id + ":" + s.owner),
            minions: minions.map((m) => m.kind + "@" + m.lv), cores: G.cores.slice(),
            buildings: buildings.map((b) => b.id), enemies: enemies.length
          };
        }
      };
    }
  }

  boot();
})();
