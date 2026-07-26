import type { Component } from 'vue';
import {
  Activity,
  Atom,
  Bike,
  Bot,
  Boxes,
  BrainCircuit,
  Building2,
  Cake,
  CircleDashed,
  CircuitBoard,
  Clock3,
  CloudRain,
  CloudUpload,
  Code2,
  Component as ComponentIcon,
  Cpu,
  Crosshair,
  Crown,
  DatabaseZap,
  Dna,
  Eclipse,
  Expand,
  Eye,
  Gauge,
  Gem,
  Globe,
  Layers,
  Orbit,
  PartyPopper,
  Plane,
  Radar,
  Radiation,
  Radio,
  Rocket,
  Satellite,
  ScanLine,
  Shield,
  Slice,
  Sparkles,
  Star,
  Sun,
  Telescope,
  Waves,
  Zap,
} from 'lucide-vue-next';

/**
 * NEXUS 深空中枢 · 统一视觉协议系统（三期重构）
 *
 * 所有签到特效同属一个世界观：GitInsight 的 AI 中枢是一座深空指挥舰桥，
 * 每个特效都是一次由甲币能量授权执行的「视觉协议」（Visual Protocol）。
 * 本文件是特效体系的唯一契约 —— 命名、分级、四段动效、镜头语言、
 * 配色与舞台背景全部在此声明；RewardEffectOverlay 读取这些数据驱动
 * 统一的电影舞台，CheckinRewardCenter 读取它们渲染分级商店。
 */

export type RewardEffectKey =
  | 'fireworks'
  | 'birthday'
  | 'sparkle'
  | 'aurora'
  | 'warp'
  | 'matrix'
  | 'crown'
  | 'neonDrive'
  | 'cockpit'
  | 'holoCore'
  | 'laserGrid'
  | 'quantumGate'
  | 'cyberDataFlow'
  | 'velocityTrail'
  | 'cityScan'
  | 'floatingHud'
  | 'neuralThink'
  | 'timeFold'
  | 'rainGlass'
  | 'codeMaterialize'
  | 'energyRing'
  | 'droneFlyover'
  | 'quantumFlicker'
  | 'breathingUi'
  | 'dataStorm'
  | 'glassRefraction'
  | 'spaceJump'
  | 'blackHole'
  | 'supernova'
  | 'gravityWave'
  | 'riftTear'
  | 'aiAwaken'
  | 'dysonRing'
  | 'collider'
  | 'mechaBoot'
  | 'orbitalStrike'
  | 'galaxyMap'
  | 'solarFlare'
  | 'nanoSwarm'
  | 'holoDisassemble'
  | 'rocketLaunch'
  | 'bioScan'
  | 'empBlast'
  | 'littleBoy'
  | 'satelliteSweep'
  | 'energyShield'
  | 'deepSonar'
  | 'skyUplink';

/** 视觉压制分级：信标(4-6) → 战术(7-10) → 奇点(11-14)，随甲币定价单调升级 */
export type EffectTierKey = 'signal' | 'tactical' | 'singularity';

/**
 * 舞台镜头预设（由 RewardEffectOverlay 的相机 rig 实现）：
 * - none     组件自带镜头（如黑洞/空间折跃），舞台不叠加，避免双重运镜
 * - still    定机位，仅开场极轻的落定
 * - drift    缓慢漂移推近，氛围型
 * - dolly    开场推镜落定 → 中段微漂 → 结尾回拉
 * - sweep    横向视差扫移 + 轻推，扫描/掠过型
 * - ascend   仰角上升 + 推镜，发射/上行型
 * - warp     尺度呼吸 + 失焦脉冲，跃迁/量子型
 * - punch    爆点急推 + 震屏，打击/爆发型
 * - collapse 加速吸入 → 反弹回冲，引力/坍缩型
 */
export type EffectCameraPreset =
  | 'none'
  | 'still'
  | 'drift'
  | 'dolly'
  | 'sweep'
  | 'ascend'
  | 'warp'
  | 'punch'
  | 'collapse';

/** 四段式时间结构（ms）。entry+loop+exit 恒等于该特效总时长，供舞台编排开幕/闭幕 */
export interface EffectPhaseSpec {
  /** 进入：世界让位 —— 光圈展开、能量注入、HUD 上线 */
  entry: number;
  /** 持续：特效自身的三幕演出（蓄势→爆发→余韵） */
  loop: number;
  /** 退出：世界回收 —— 内容收束、协议完成、光线归位 */
  exit: number;
}

/** 四段动效说明（中文），同时用于设计文档与商店提示 */
export interface EffectMotionSpec {
  entry: string;
  loop: string;
  exit: string;
  camera: string;
}

export interface RewardEffectOption {
  key: RewardEffectKey;
  /** 中文产品名（2-4 字为主） */
  label: string;
  /** 英文协议代号，全大写，舞台 HUD 与商店副标使用 */
  codename: string;
  /** 一句话事件叙事 */
  narrative: string;
  cost: number;
  tier: EffectTierKey;
  /** 巅峰演出（cost ≥ 13），商店内在奇点级之上再加 APEX 徽记 */
  apex?: boolean;
  icon: Component;
  /** 商店卡片强调色 */
  tone: string;
  /** 舞台主色 / 辅色（辉光、冲击波、HUD、能量注入均取自这里） */
  accent: string;
  secondary: string;
  /** 舞台背景（CSS background），统一深空底 + 特效专属氛围 */
  backdrop: string;
  camera: EffectCameraPreset;
  /** 震屏强度 0-2（punch/爆点类使用） */
  shake: 0 | 1 | 2;
  phases: EffectPhaseSpec;
  motion: EffectMotionSpec;
}

export interface EffectTierMeta {
  key: EffectTierKey;
  grade: 1 | 2 | 3;
  label: string;
  codename: string;
  tagline: string;
  costRange: [number, number];
}

export const EFFECT_TIERS: Record<EffectTierKey, EffectTierMeta> = {
  signal: {
    key: 'signal',
    grade: 1,
    label: '信标级',
    codename: 'SIGNAL',
    tagline: '舱内光学仪式 · 粒子 / 光晕 / 单色秩序',
    costRange: [4, 6],
  },
  tactical: {
    key: 'tactical',
    grade: 2,
    label: '战术级',
    codename: 'TACTICAL',
    tagline: '战术界面演出 · 层级空间 / 光流 / 扫描 / 透视',
    costRange: [7, 10],
  },
  singularity: {
    key: 'singularity',
    grade: 3,
    label: '奇点级',
    codename: 'SINGULARITY',
    tagline: '宇宙级事件 · 镜头语言 / 时空尺度 / 三幕叙事',
    costRange: [11, 14],
  },
};

export const EFFECT_OPTIONS: readonly RewardEffectOption[] = [
  // ── 信标级 SIGNAL（4-6 甲币）────────────────────────────────
  {
    key: 'fireworks',
    label: '轨道礼焰',
    codename: 'ORBITAL SALVO',
    narrative: '舰桥外舷升起多波次庆典齐射，金焰在深空绽放。',
    cost: 4,
    tier: 'signal',
    icon: PartyPopper,
    tone: '#f59e0b',
    accent: '#f59e0b',
    secondary: '#60a5fa',
    backdrop:
      'radial-gradient(circle at 50% 72%, rgba(59, 108, 246, 0.18), transparent 38%), linear-gradient(180deg, rgba(15, 23, 42, 0.56), rgba(15, 23, 42, 0.18))',
    camera: 'still',
    shake: 0,
    phases: { entry: 500, loop: 3000, exit: 700 },
    motion: {
      entry: '首枚火箭拖尾升空，舞台暗场让位夜空',
      loop: '多波次爆裂：白热闪心 + 冲击环 + 重力火花球，余烬坠落二次噼啪',
      exit: '终场三连齐射后余星闪灭，光圈回收',
      camera: '定机位仰视，仅开场轻微落定',
    },
  },
  {
    key: 'birthday',
    label: '星诞庆典',
    codename: 'STELLAR GALA',
    narrative: '双舷礼炮向舰桥中央抛洒彩屑，全息贺卡通电成型。',
    cost: 5,
    tier: 'signal',
    icon: Cake,
    tone: '#ec4899',
    accent: '#ec4899',
    secondary: '#fbbf24',
    backdrop:
      'radial-gradient(circle at 50% 46%, rgba(236, 72, 153, 0.22), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(59, 108, 246, 0.1))',
    camera: 'still',
    shake: 0,
    phases: { entry: 550, loop: 3300, exit: 750 },
    motion: {
      entry: '左右礼炮同步开火，贺卡自下方弹升入位',
      loop: '三轮交替礼炮 + 粉金星光爆点，顶部细彩屑持续飘落翻转',
      exit: '贺卡上浮熄灭，残余彩屑落定',
      camera: '定机位，礼炮开火瞬间轻微落定',
    },
  },
  {
    key: 'sparkle',
    label: '鎏金流光',
    codename: 'LUMEN TIDE',
    narrative: '三条金色光河横贯舷窗，星尘随波起伏明灭。',
    cost: 4,
    tier: 'signal',
    icon: Sparkles,
    tone: '#fbbf24',
    accent: '#f59e0b',
    secondary: '#60a5fa',
    backdrop:
      'radial-gradient(circle at 50% 48%, rgba(251, 191, 36, 0.18), transparent 36%), linear-gradient(120deg, rgba(255, 255, 255, 0.12), rgba(251, 191, 36, 0.1))',
    camera: 'drift',
    shake: 0,
    phases: { entry: 450, loop: 2500, exit: 650 },
    motion: {
      entry: '中心金环荡开 + 光尘迸发，三条光绶带斜向亮起',
      loop: '正弦光河长拖尾横流，漂浮金尘上升，四芒星闪点缀',
      exit: '光河尾段流出画面，勋章旋转淡出',
      camera: '缓慢漂移推近，跟随光河流向',
    },
  },
  {
    key: 'aurora',
    label: '极光天幕',
    codename: 'AURORA VEIL',
    narrative: '电离风暴掠过舷窗，三层光帘正弦摆动，偶有流星。',
    cost: 6,
    tier: 'signal',
    icon: Gem,
    tone: '#22c55e',
    accent: '#22c55e',
    secondary: '#38bdf8',
    backdrop:
      'linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(15, 23, 42, 0.22)), radial-gradient(circle at 50% 100%, rgba(34, 197, 94, 0.18), transparent 46%)',
    camera: 'drift',
    shake: 0,
    phases: { entry: 700, loop: 3600, exit: 900 },
    motion: {
      entry: '星野渐显，光帘自地平线缓缓升起展开',
      loop: '三层色相流动的极光丝带正弦摆动，极光尘上浮，流星偶发划落',
      exit: '光帘垂落收拢，星野最后闪烁熄灭',
      camera: '极缓漂移，仰角凝视天幕',
    },
  },
  {
    key: 'matrix',
    label: '神经码域',
    codename: 'NEURAL CODE FIELD',
    narrative: '意识流字符自穹顶垂落，扫描波逐层读取奖励关键字。',
    cost: 5,
    tier: 'signal',
    icon: ScanLine,
    tone: '#34d399',
    accent: '#34d399',
    secondary: '#22d3ee',
    backdrop:
      'linear-gradient(180deg, rgba(2, 6, 23, 0.66), rgba(6, 78, 59, 0.2)), radial-gradient(circle at center, rgba(52, 211, 153, 0.14), transparent 48%)',
    camera: 'drift',
    shake: 0,
    phases: { entry: 500, loop: 3350, exit: 750 },
    motion: {
      entry: '字符雨头自屏顶逐列落入，控制台通电亮起',
      loop: '真字符雨步进下落带渐隐尾迹，金色奖励词偶现，横向扫描波周期推进',
      exit: '雨幕稀疏熄灭，控制台上浮关机',
      camera: '缓慢推近码域深处',
    },
  },

  // ── 战术级 TACTICAL（7-10 甲币）──────────────────────────────
  {
    key: 'warp',
    label: '星际跃迁',
    codename: 'WARP TRANSIT',
    narrative: '星光自跃迁点拉伸成隧道，脉冲环层层推向舰首。',
    cost: 7,
    tier: 'tactical',
    icon: Rocket,
    tone: '#60a5fa',
    accent: '#60a5fa',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at center, rgba(96, 165, 250, 0.26), rgba(15, 23, 42, 0.5) 45%, rgba(15, 23, 42, 0.12))',
    camera: 'warp',
    shake: 0,
    phases: { entry: 450, loop: 2950, exit: 800 },
    motion: {
      entry: '引擎点火白闪，首圈跃迁脉冲环荡开',
      loop: '星点自中心透视加速外冲成光条隧道，脉冲环周期推进',
      exit: '巨大白蓝闪光收束，全向光条爆散后归寂',
      camera: '隧道呼吸：尺度胀缩 + 失焦脉冲模拟超空间',
    },
  },
  {
    key: 'crown',
    label: '加冕仪典',
    codename: 'SOVEREIGN RITE',
    narrative: '十道神辉光束绕轴旋转，金雨自穹顶为指挥官加冕。',
    cost: 8,
    tier: 'tactical',
    icon: Crown,
    tone: '#eab308',
    accent: '#facc15',
    secondary: '#f97316',
    backdrop:
      'radial-gradient(circle at 50% 44%, rgba(250, 204, 21, 0.22), transparent 36%), linear-gradient(180deg, rgba(66, 32, 6, 0.4), rgba(250, 204, 21, 0.08))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 550, loop: 3450, exit: 800 },
    motion: {
      entry: '金辉光束自中心展开旋转，徽章浮现',
      loop: '加冕爆发：金色火花 + 三重光环，底部余烬升腾，宝石菱光环绕',
      exit: '终章金雨洒落，徽章上浮隐没，光束收束',
      camera: '开场推镜落定，结尾缓缓回拉致礼',
    },
  },
  {
    key: 'cityScan',
    label: '城域测绘',
    codename: 'URBAN SWEEP',
    narrative: '扫描前沿自穹顶推进，全城建筑逐格点亮并上传数据。',
    cost: 8,
    tier: 'tactical',
    icon: Building2,
    tone: '#2dd4bf',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'linear-gradient(180deg, rgba(8, 47, 73, 0.68), rgba(2, 6, 23, 0.18)), radial-gradient(circle at 50% 80%, rgba(45, 212, 191, 0.2), transparent 44%)',
    camera: 'sweep',
    shake: 0,
    phases: { entry: 500, loop: 3600, exit: 700 },
    motion: {
      entry: '透视城市网格升起，扫描光带自屏顶压入',
      loop: '扫描前沿掠过处识别环 + 十六进制识别码迸出，建筑数据光条持续上传',
      exit: '全城点亮确认脉冲，网格降落熄灭',
      camera: '横向视差扫移，跟随扫描前沿推进',
    },
  },
  {
    key: 'energyRing',
    label: '储能环阵',
    codename: 'CHARGE TORUS',
    narrative: '能量自四周汇入轨道环，满充后三重冲击波放电。',
    cost: 8,
    tier: 'tactical',
    icon: CircleDashed,
    tone: '#60a5fa',
    accent: '#60a5fa',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at center, rgba(96, 165, 250, 0.28), transparent 36%), linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(45, 212, 191, 0.14))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 500, loop: 3600, exit: 700 },
    motion: {
      entry: 'SVG 三色环阵展开，外围能量开始被吸入',
      loop: '粒子沿轨道环加速环流，充能 3.2s 达峰 → 白闪爆发 + 全向火花 + 三重冲击环',
      exit: '放电余晖电荷微粒飘散，环阵收拢',
      camera: '推镜锁定环阵，放电瞬间借冲击环外扩泄力',
    },
  },
  {
    key: 'breathingUi',
    label: '稳态脉息',
    codename: 'STASIS PULSE',
    narrative: '界面随呼吸节律胀缩，萤光随吸气聚拢、呼气散开。',
    cost: 8,
    tier: 'tactical',
    icon: Activity,
    tone: '#22c55e',
    accent: '#22c55e',
    secondary: '#38bdf8',
    backdrop:
      'radial-gradient(circle at center, rgba(34, 197, 94, 0.2), transparent 42%), linear-gradient(180deg, rgba(20, 83, 45, 0.48), rgba(2, 6, 23, 0.18))',
    camera: 'drift',
    shake: 0,
    phases: { entry: 800, loop: 3800, exit: 1000 },
    motion: {
      entry: '界面壳层缓缓显影，第一次吸气开始',
      loop: '3.2s 呼吸周期：光晕胀缩、卡片明暗同步、萤火虫聚散，每次呼吸顶点荡开柔涟漪',
      exit: '最后一次深呼气，界面沉入静息暗场',
      camera: '几乎不动的漂移，与呼吸同频的极微推拉',
    },
  },
  {
    key: 'neonDrive',
    label: '霓虹疾驰',
    codename: 'NITRO HORIZON',
    narrative: '合成波地平线上光轨自消失点喷射，氮气脉冲环推进。',
    cost: 9,
    tier: 'tactical',
    icon: Zap,
    tone: '#f472b6',
    accent: '#f472b6',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at 50% 70%, rgba(244, 114, 182, 0.24), transparent 34%), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(76, 29, 149, 0.24))',
    camera: 'sweep',
    shake: 0,
    phases: { entry: 600, loop: 3800, exit: 800 },
    motion: {
      entry: '天际线与透视路面亮起，落日光球呼吸显现',
      loop: '霓虹光轨自消失点两侧加速飞出，路面标线冲屏，氮气火花上蹿，脉冲环周期爆发',
      exit: '光轨尾流拉长驶离，天际线沉入夜色',
      camera: '低机位视差横移 + 轻推，公路追逐镜头',
    },
  },
  {
    key: 'laserGrid',
    label: '激光栅格',
    codename: 'LASER LATTICE',
    narrative: '三横三纵光束正弦巡扫，交点命中处炸开火花。',
    cost: 9,
    tier: 'tactical',
    icon: CircuitBoard,
    tone: '#2dd4bf',
    accent: '#2dd4bf',
    secondary: '#f472b6',
    backdrop:
      'radial-gradient(circle at 50% 62%, rgba(45, 212, 191, 0.2), transparent 38%), linear-gradient(180deg, rgba(6, 78, 59, 0.42), rgba(2, 6, 23, 0.2))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 550, loop: 3650, exit: 800 },
    motion: {
      entry: '透视地板网格升起，六道光束依次通电',
      loop: '光束正弦往复巡扫，交点白闪 + 扩散环 + 火花迸溅，网格粉尘上浮',
      exit: '光束逐一断电，地板网格沉降',
      camera: '推镜进入栅格空间，中段随扫描微漂',
    },
  },
  {
    key: 'velocityTrail',
    label: '极速光轨',
    codename: 'SLIPSTREAM',
    narrative: '彩色拖尾呼啸横穿舰桥，三次加速脉冲推向屏外。',
    cost: 9,
    tier: 'tactical',
    icon: Bike,
    tone: '#38bdf8',
    accent: '#2dd4bf',
    secondary: '#f472b6',
    backdrop:
      'radial-gradient(circle at 52% 68%, rgba(14, 165, 233, 0.24), transparent 36%), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(12, 74, 110, 0.22))',
    camera: 'sweep',
    shake: 1,
    phases: { entry: 450, loop: 3600, exit: 750 },
    motion: {
      entry: '风切白线率先掠过，透视路面亮起',
      loop: '重拖尾彩色光带高速横穿，车轮尾焰持续喷流，三次白闪加速脉冲',
      exit: '尾焰断流，最后一道光轨冲出画面',
      camera: '侧向追焦横移，加速脉冲伴随轻震',
    },
  },
  {
    key: 'rainGlass',
    label: '雨幕舷窗',
    codename: 'STORMGLASS',
    narrative: '雨丝斜贯玻璃，水珠蠕行滑落，两道闪电划破夜幕。',
    cost: 9,
    tier: 'tactical',
    icon: CloudRain,
    tone: '#38bdf8',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at 30% 20%, rgba(56, 189, 248, 0.2), transparent 34%), linear-gradient(180deg, rgba(2, 6, 23, 0.78), rgba(30, 41, 59, 0.34))',
    camera: 'drift',
    shake: 0,
    phases: { entry: 700, loop: 3800, exit: 900 },
    motion: {
      entry: '夜色氤氲显影，毛玻璃舷窗浮现，雨幕开始落下',
      loop: '密集雨丝斜贯 + 落地溅花，玻璃水珠蠕行偶发急滑，两道锯齿闪电伴全屏泛光',
      exit: '雨势渐歇，舷窗雾光散去',
      camera: '窗内视角极缓漂移，闪电瞬间明暗呼吸',
    },
  },
  {
    key: 'cockpit',
    label: '轨道座舱',
    codename: 'ORBITAL COCKPIT',
    narrative: '雷达扫掠余辉锁定目标，遥测光条沿舷侧持续上行。',
    cost: 10,
    tier: 'tactical',
    icon: Gauge,
    tone: '#22d3ee',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.18), transparent 42%), linear-gradient(180deg, rgba(8, 47, 73, 0.56), rgba(2, 6, 23, 0.26))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 600, loop: 3800, exit: 800 },
    motion: {
      entry: '座舱边框 + 刻度罗盘通电，四块遥测面板依次上线',
      loop: '雷达扫掠臂旋转拖出余辉扇面，目标环收缩锁定 + 十字闪光，舷侧遥测光条上行',
      exit: '面板逐一下线，罗盘断电收拢',
      camera: '驾驶位推镜落定，罗盘缓旋带动视线',
    },
  },
  {
    key: 'cyberDataFlow',
    label: '数据洪流',
    codename: 'DATA TORRENT',
    narrative: '数据包沿曼哈顿路径直角转折疾行，双色脉冲荡开。',
    cost: 10,
    tier: 'tactical',
    icon: CircuitBoard,
    tone: '#22d3ee',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.22), transparent 42%), linear-gradient(135deg, rgba(2, 6, 23, 0.78), rgba(76, 29, 149, 0.22))',
    camera: 'sweep',
    shake: 0,
    phases: { entry: 500, loop: 3550, exit: 750 },
    motion: {
      entry: '全息机框亮起，屏幕扫光横掠，栅格单元逐块通电',
      loop: '数据包霓虹长尾直角折行、拐点留亮结，字符串横向掠过，青粉双色脉冲交替荡开',
      exit: '洪流退潮，机框栅格熄灭',
      camera: '沿电路走向的视差横移',
    },
  },
  {
    key: 'floatingHud',
    label: '悬浮阵列',
    codename: 'HOLO ARRAY',
    narrative: '八面全息面板绕准星纵深展开，数据链路点对点激射。',
    cost: 10,
    tier: 'tactical',
    icon: Radar,
    tone: '#67e8f9',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at center, rgba(34, 211, 238, 0.2), transparent 46%), linear-gradient(180deg, rgba(15, 23, 42, 0.62), rgba(8, 47, 73, 0.22))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 600, loop: 3800, exit: 800 },
    motion: {
      entry: '倾斜轨道环展开，八面板按 Z 深度依次翻入',
      loop: '双向轨道流光环绕准星，面板间数据光束点对点激射并回应涟漪，全息尘上浮',
      exit: '面板逐层翻出隐没，轨道环收束',
      camera: '带透视的推镜，面板 Z 深度随镜头微移产生视差',
    },
  },
  {
    key: 'timeFold',
    label: '时间折叠',
    codename: 'TEMPORAL FOLD',
    narrative: '空间面板折起，时之砂倒流一拍，再恢复正向流动。',
    cost: 10,
    tier: 'tactical',
    icon: Clock3,
    tone: '#93c5fd',
    accent: '#60a5fa',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at center, rgba(147, 197, 253, 0.22), transparent 38%), linear-gradient(180deg, rgba(15, 23, 42, 0.64), rgba(30, 64, 175, 0.16))',
    camera: 'warp',
    shake: 0,
    phases: { entry: 550, loop: 3550, exit: 800 },
    motion: {
      entry: '九块空间面板 3D 折入展开，表盘刻度点亮',
      loop: '秒针粒子流绕盘旋转；2.2s 白闪触发倒流（砂粒上升、涟漪内收、残像反旋），3.6s 恢复正向',
      exit: '面板反向折起坍闭，表盘旋转淡出',
      camera: '尺度呼吸：倒流瞬间收缩、恢复时舒张',
    },
  },
  {
    key: 'codeMaterialize',
    label: '代码铸形',
    codename: 'CODE FORGE',
    narrative: '字符被牵引至铸形台，收束闪光凝成可交付实体。',
    cost: 10,
    tier: 'tactical',
    icon: Code2,
    tone: '#22c55e',
    accent: '#34d399',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at 62% 62%, rgba(34, 197, 94, 0.2), transparent 40%), linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(20, 83, 45, 0.18))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 550, loop: 3650, exit: 800 },
    motion: {
      entry: '左侧代码行逐行显影，透视铸形台通电',
      loop: '四周字符被追踪加速度吸附飞向铸形台，接近时收缩闪光；能量环周期积聚',
      exit: '构建完成绿色确认爆发，代码行飞入台面熄灭',
      camera: '自码区向铸形台的缓慢推移',
    },
  },
  {
    key: 'glassRefraction',
    label: '棱镜析光',
    codename: 'PRISM FACET',
    narrative: '五层玻璃错位展开，色散光束斜扫，光谱碎钻明灭。',
    cost: 10,
    tier: 'tactical',
    icon: Layers,
    tone: '#7dd3fc',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at 30% 24%, rgba(125, 249, 255, 0.16), transparent 34%), radial-gradient(circle at 72% 78%, rgba(244, 114, 182, 0.14), transparent 34%), linear-gradient(180deg, rgba(15, 23, 42, 0.52), rgba(2, 6, 23, 0.18))',
    camera: 'drift',
    shake: 0,
    phases: { entry: 650, loop: 3700, exit: 850 },
    motion: {
      entry: '五层毛玻璃自中心错位旋出展开',
      loop: '色相循环的色散光束斜扫全屏，玻璃条纹往复漂移，光谱碎钻与星芒闪烁',
      exit: '玻璃层回位合拢，光束扫出画面',
      camera: '缓慢漂移，借玻璃层错位制造视差',
    },
  },
  {
    key: 'deepSonar',
    label: '深渊声呐',
    codename: 'ABYSS SONAR',
    narrative: '声呐臂旋扫点亮生物光点，巨鲸暗影横越深渊。',
    cost: 10,
    tier: 'tactical',
    icon: Radio,
    tone: '#22d3ee',
    accent: '#22d3ee',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at 50% 60%, rgba(34, 211, 238, 0.14), transparent 44%), linear-gradient(180deg, rgba(1, 8, 18, 0.88), rgba(3, 30, 48, 0.44))',
    camera: 'drift',
    shake: 0,
    phases: { entry: 700, loop: 3850, exit: 850 },
    motion: {
      entry: '深青暗场下潜，气泡上浮，探照灯锥光左右缓摆',
      loop: '声呐扫描臂旋转拖出余辉扇面，扫过点亮生物光点群，同心脉冲外扩遇目标回波增亮',
      exit: '鲸影横越 CONTACT 确认后，声呐熄灭归于深暗',
      camera: '深海失重感的极缓漂移',
    },
  },
  {
    key: 'skyUplink',
    label: '云端上行',
    codename: 'SKY UPLINK',
    narrative: '数据池沸腾上涌，束流为云核充能直至同步完成。',
    cost: 10,
    tier: 'tactical',
    icon: CloudUpload,
    tone: '#60a5fa',
    accent: '#93c5fd',
    secondary: '#818cf8',
    backdrop:
      'radial-gradient(circle at 50% 22%, rgba(96, 165, 250, 0.22), transparent 36%), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(30, 58, 138, 0.24))',
    camera: 'ascend',
    shake: 0,
    phases: { entry: 550, loop: 3850, exit: 800 },
    motion: {
      entry: '底部 0/1 字符池翻涌沸腾，云核图标亮起',
      loop: '多条垂直数据束携字符上行冲击云核，环形进度弧随命中跳动充能',
      exit: '进度 100% 云核爆出确认环，金色光雨回洒全屏',
      camera: '仰角缓慢上升，跟随束流指向云端',
    },
  },

  // ── 奇点级 SINGULARITY（11-14 甲币）──────────────────────────
  {
    key: 'holoCore',
    label: '全息中枢',
    codename: 'HOLO NEXUS',
    narrative: '三层轨道环绕核心反向旋转，能量柱盘升宣告上线。',
    cost: 11,
    tier: 'singularity',
    icon: Cpu,
    tone: '#a78bfa',
    accent: '#a78bfa',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.24), transparent 36%), linear-gradient(180deg, rgba(30, 27, 75, 0.58), rgba(2, 6, 23, 0.22))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 550, loop: 4000, exit: 850 },
    motion: {
      entry: '上线瞬间紫色数据爆发，核心面板通电',
      loop: '三层透视椭圆轨道反向环流（后侧粒子压暗成遮挡立体感），中轴能量柱盘旋上升，干涉环荡开',
      exit: '轨道逐层减速消隐，核心波光熄灭',
      camera: '环绕感推镜，凝视中枢结构',
    },
  },
  {
    key: 'neuralThink',
    label: '突触风暴',
    codename: 'SYNAPSE STORM',
    narrative: '脉冲沿神经拓扑级联传导，顿悟时刻全网齐亮。',
    cost: 11,
    tier: 'singularity',
    icon: BrainCircuit,
    tone: '#a78bfa',
    accent: '#a78bfa',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at 50% 45%, rgba(167, 139, 250, 0.24), transparent 40%), linear-gradient(180deg, rgba(30, 27, 75, 0.64), rgba(2, 6, 23, 0.2))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 600, loop: 3750, exit: 850 },
    motion: {
      entry: '随机神经拓扑显影，节点呼吸辉光亮起',
      loop: '思考脉冲沿边奔跑点亮节点并按概率级联传播，命中节点充能发亮后缓慢衰减',
      exit: '顿悟时刻全网齐亮 + 中心紫爆，随后网络熄灭',
      camera: '缓慢推入网络深处，顿悟瞬间定格',
    },
  },
  {
    key: 'droneFlyover',
    label: '掠城航线',
    codename: 'SKYLINE RUN',
    narrative: '镜头低掠霓虹城市，导航灯明灭，锁定框逐一确认。',
    cost: 11,
    tier: 'singularity',
    icon: Plane,
    tone: '#14b8a6',
    accent: '#22d3ee',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at 50% 78%, rgba(45, 212, 191, 0.2), transparent 42%), linear-gradient(180deg, rgba(12, 74, 110, 0.58), rgba(2, 6, 23, 0.24))',
    camera: 'sweep',
    shake: 0,
    phases: { entry: 600, loop: 3800, exit: 800 },
    motion: {
      entry: '透视城市自远处压入（Z 轴飞入），螺旋桨气流卷起',
      loop: '城市灯光自地平线消失点向两侧透视加速飞掠，红绿信标闪烁，HUD 括号周期锁定目标',
      exit: '城市沉入身后（Z 轴飞出），航线灯熄灭',
      camera: '低空掠航视差横移，与城市 Z 轴位移叠加成穿行感',
    },
  },
  {
    key: 'dataStorm',
    label: '数据风暴',
    codename: 'DATA MAELSTROM',
    narrative: '字符涡旋绕风暴核心盘旋，锯齿闪电自风眼劈出。',
    cost: 11,
    tier: 'singularity',
    icon: DatabaseZap,
    tone: '#2dd4bf',
    accent: '#34d399',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at 50% 62%, rgba(45, 212, 191, 0.24), transparent 40%), linear-gradient(180deg, rgba(6, 78, 59, 0.46), rgba(2, 6, 23, 0.24))',
    camera: 'punch',
    shake: 1,
    phases: { entry: 550, loop: 3650, exit: 800 },
    motion: {
      entry: '风暴核心呼吸辉光亮起，图表面板升起',
      loop: '字符与光点绕核椭圆盘旋、半径起伏，锯齿闪电周期劈出并在端点炸花，数据柱依次生长',
      exit: '涡旋减速散逸，闪电熄灭图表落幕',
      camera: '闪电劈落瞬间急推 + 轻震',
    },
  },
  {
    key: 'bioScan',
    label: '生体校验',
    codename: 'HELIX VERIFY',
    narrative: '扫描带掠过全身，双螺旋对旋上升，身份确认通过。',
    cost: 11,
    tier: 'singularity',
    icon: Dna,
    tone: '#34d399',
    accent: '#4ade80',
    secondary: '#a3e635',
    backdrop:
      'radial-gradient(circle at center, rgba(52, 211, 153, 0.16), transparent 44%), linear-gradient(180deg, rgba(2, 6, 23, 0.76), rgba(2, 44, 34, 0.3))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 600, loop: 3950, exit: 850 },
    motion: {
      entry: '横向扫描光带自上而下推进，路径迸出网格火花',
      loop: '双串粒子按正弦相位对旋上升成 DNA 螺旋，短光条连接碱基横杠，随机碱基高亮闪烁',
      exit: '螺旋收束成纵向光柱，绿色确认环绽放 IDENTITY VERIFIED',
      camera: '沿螺旋上升方向缓推跟随',
    },
  },
  {
    key: 'empBlast',
    label: '电磁脉冲',
    codename: 'EMP CASCADE',
    narrative: '核球电弧充能到临界，畸变环席卷全屏引发乱码瘫痪。',
    cost: 11,
    tier: 'singularity',
    icon: Radiation,
    tone: '#fbbf24',
    accent: '#facc15',
    secondary: '#fb923c',
    backdrop:
      'radial-gradient(circle at center, rgba(251, 191, 36, 0.2), transparent 36%), linear-gradient(180deg, rgba(2, 6, 23, 0.78), rgba(41, 37, 36, 0.36))',
    camera: 'punch',
    shake: 2,
    phases: { entry: 700, loop: 3500, exit: 800 },
    motion: {
      entry: '中心核球电弧噼啪缠绕，电荷粒子加速聚集',
      loop: '1.8s 临界：畸变冲击环高速扩散，波前炸出乱码字符雨与火花，DOM 层 glitch 切片抖动 + RGB 错位',
      exit: '四角残余电弧偶发闪跳，字符雨熄灭，末次微弱复电',
      camera: '脉冲爆发瞬间急推 + 强震屏，全屏色差撕裂',
    },
  },
  {
    key: 'satelliteSweep',
    label: '卫星过境',
    codename: 'SATCOM PASS',
    narrative: '卫星展开太阳翼过境，通讯波束下行，地面站应答。',
    cost: 11,
    tier: 'singularity',
    icon: Satellite,
    tone: '#38bdf8',
    accent: '#22d3ee',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at 50% 96%, rgba(56, 189, 248, 0.24), transparent 40%), linear-gradient(180deg, rgba(2, 6, 23, 0.8), rgba(8, 47, 73, 0.26))',
    camera: 'sweep',
    shake: 0,
    phases: { entry: 650, loop: 4100, exit: 850 },
    motion: {
      entry: '屏底地球弧线与大气辉光显影，星野缓漂',
      loop: '卫星沿抛物线过境展开太阳翼，向地面投射三角波束，数据字符沿束下行，地面站脉冲应答',
      exit: 'UPLINK 100% 同步完成，卫星驶出留轨迹余光',
      camera: '跟随卫星轨迹的横移长镜头',
    },
  },
  {
    key: 'energyShield',
    label: '相位护盾',
    codename: 'PHASE AEGIS',
    narrative: '蜂窝盾面逐圈点亮，承受弹头冲击，涟漪传播不破。',
    cost: 11,
    tier: 'singularity',
    icon: Shield,
    tone: '#4ade80',
    accent: '#4ade80',
    secondary: '#a3e635',
    backdrop:
      'radial-gradient(circle at center, rgba(74, 222, 128, 0.16), transparent 42%), linear-gradient(180deg, rgba(2, 6, 23, 0.74), rgba(5, 46, 22, 0.3))',
    camera: 'punch',
    shake: 1,
    phases: { entry: 600, loop: 3950, exit: 850 },
    motion: {
      entry: '六边形蜂窝盾面自中心逐圈点亮铺满（伪球面透视）',
      loop: '来袭光矢命中盾面：命中格高亮、邻接格延迟点亮成涟漪传播，火花迸溅',
      exit: '盾面流光巡回一周 SHIELD 100%，呼吸微光淡出',
      camera: '承击瞬间急推 + 短震，盾面反光回弹',
    },
  },
  {
    key: 'quantumGate',
    label: '量子虫洞',
    codename: 'WORMHOLE GATE',
    narrative: '吸积盘螺旋坠入奇点，引力波纹收缩，喷流对射。',
    cost: 12,
    tier: 'singularity',
    icon: Orbit,
    tone: '#818cf8',
    accent: '#a78bfa',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at center, rgba(129, 140, 248, 0.3), transparent 32%), linear-gradient(180deg, rgba(49, 46, 129, 0.62), rgba(2, 6, 23, 0.22))',
    camera: 'collapse',
    shake: 0,
    phases: { entry: 600, loop: 4100, exit: 900 },
    motion: {
      entry: '奇点呼吸光核亮起，首圈引力波纹收缩坠入',
      loop: '粒子沿透视椭圆螺旋坠入、越近越快且色相偏移，垂直能量喷流周期对射',
      exit: '洞口收拢，末圈波纹坠入后归于寂静',
      camera: '加速吸入式缓推，被引力拉向洞口',
    },
  },
  {
    key: 'quantumFlicker',
    label: '量子隧穿',
    codename: 'QUANTUM TUNNEL',
    narrative: '粒子团瞬现瞬灭，电弧缠绕，五重残影坍缩合一。',
    cost: 12,
    tier: 'singularity',
    icon: Atom,
    tone: '#c4b5fd',
    accent: '#a78bfa',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at 50% 50%, rgba(196, 181, 253, 0.28), transparent 34%), linear-gradient(180deg, rgba(49, 46, 129, 0.62), rgba(2, 6, 23, 0.22))',
    camera: 'warp',
    shake: 0,
    phases: { entry: 450, loop: 3600, exit: 750 },
    motion: {
      entry: '第一簇隧穿爆点瞬现，原子核心光云聚拢',
      loop: '粒子团随机位置瞬现瞬灭（白闪 + 环 + 位错闪痕），中心电弧折线抖动缠绕，五重残影步进闪烁',
      exit: '残影自五个相位坍缩合一后湮灭',
      camera: '量子不确定感的尺度抖动呼吸',
    },
  },
  {
    key: 'spaceJump',
    label: '空间折跃',
    codename: 'FOLD JUMP',
    narrative: '能量吸入螺旋坍缩，闪爆后星流全速外冲穿越。',
    cost: 12,
    tier: 'singularity',
    icon: Expand,
    tone: '#818cf8',
    accent: '#a78bfa',
    secondary: '#22d3ee',
    backdrop:
      'radial-gradient(circle at center, rgba(129, 140, 248, 0.3), rgba(15, 23, 42, 0.56) 42%, rgba(15, 23, 42, 0.14)), linear-gradient(180deg, rgba(30, 27, 75, 0.58), rgba(2, 6, 23, 0.24))',
    camera: 'none',
    shake: 0,
    phases: { entry: 550, loop: 3600, exit: 850 },
    motion: {
      entry: '外围能量螺旋吸入向奇点坍缩（幕一 0-1.5s）',
      loop: '1.55s 跃迁闪爆 + 三重冲击环，随后星流自中心透视全速外冲成穿越隧道',
      exit: '隧道流速衰减，舱体光环旋散',
      camera: '组件自带镜头：推拉 + 失焦脉冲全程编排（舞台不叠加）',
    },
  },
  {
    key: 'collider',
    label: '粒子对撞',
    codename: 'HADRON IGNITION',
    narrative: '双束反向加速逐圈增亮，顶点对撞喷注出新粒子。',
    cost: 12,
    tier: 'singularity',
    icon: Atom,
    tone: '#2dd4bf',
    accent: '#22d3ee',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at 50% 24%, rgba(45, 212, 191, 0.22), transparent 36%), linear-gradient(180deg, rgba(2, 6, 23, 0.74), rgba(4, 47, 46, 0.28))',
    camera: 'punch',
    shake: 2,
    phases: { entry: 700, loop: 4050, exit: 850 },
    motion: {
      entry: '环形加速器轨道显影，四段加速腔高亮',
      loop: '两簇粒子束反向逐圈加速增亮；2.4s 顶点对撞白闪，锥形喷注 + 磁偏转螺旋径迹重现云室',
      exit: '粒子符号 μ π γ ν 发光漂浮，能级弧线余韵消散',
      camera: '对撞瞬间急推顶点 + 强震屏',
    },
  },
  {
    key: 'mechaBoot',
    label: '机甲唤醒',
    codename: 'TITAN ONLINE',
    narrative: '终端逐行自检，目镜光缝点亮，全系统涌流上线。',
    cost: 12,
    tier: 'singularity',
    icon: Bot,
    tone: '#22d3ee',
    accent: '#22d3ee',
    secondary: '#2dd4bf',
    backdrop:
      'radial-gradient(circle at 50% 44%, rgba(34, 211, 238, 0.16), transparent 42%), linear-gradient(180deg, rgba(1, 4, 12, 0.84), rgba(8, 47, 73, 0.3))',
    camera: 'punch',
    shake: 1,
    phases: { entry: 900, loop: 4200, exit: 900 },
    motion: {
      entry: '黑场终端逐行自检 REACTOR/SERVO/NEURAL LINK，字符碎屑坠落',
      loop: '2.2s 双目光缝自中线向两侧展开点亮，机体蒸汽上浮；HUD 环序列递次展开，边缘电流迸溅',
      exit: 'power-surge 全屏微闪 ALL SYSTEMS NOMINAL，目镜熄灭待机',
      camera: '点睛与上电涌流两次急推 + 机体重量感震屏',
    },
  },
  {
    key: 'orbitalStrike',
    label: '天基打击',
    codename: 'KINETIC LANCE',
    narrative: '准星锁定后炽白光柱贯落，冲击环推开地表尘暴。',
    cost: 12,
    tier: 'singularity',
    icon: Crosshair,
    tone: '#f87171',
    accent: '#f87171',
    secondary: '#67e8f9',
    backdrop:
      'radial-gradient(circle at 50% 58%, rgba(248, 113, 113, 0.2), transparent 38%), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(69, 10, 10, 0.26))',
    camera: 'punch',
    shake: 2,
    phases: { entry: 700, loop: 3700, exit: 800 },
    motion: {
      entry: '十字准星旋转收拢锁定，四角警示条闪烁 TARGET LOCKED',
      loop: '1.6s 炽白光柱自屏顶贯落（宽度脉冲 + 青色电离缘），落点白闪后半圆火花溅射 + 三道冲击环 + 烟尘缓升',
      exit: '地表裂纹发红渐熄，警示解除',
      camera: '光柱贯落瞬间猛烈急推 + 重震屏',
    },
  },
  {
    key: 'littleBoy',
    label: '小男孩',
    codename: 'LITTLE BOY',
    narrative: '白闪吞没天际，蘑菇云贯穿云层，冲击前沿将城市与地表彻底抹除。',
    cost: 14,
    tier: 'singularity',
    apex: true,
    icon: Radiation,
    tone: '#f97316',
    accent: '#fb923c',
    secondary: '#fef3c7',
    backdrop:
      'radial-gradient(circle at 50% 70%, rgba(255, 247, 237, 0.36), transparent 34%), radial-gradient(circle at 50% 42%, rgba(248, 113, 113, 0.18), transparent 42%), linear-gradient(180deg, rgba(12, 10, 9, 0.86), rgba(69, 10, 10, 0.36))',
    camera: 'punch',
    shake: 2,
    phases: { entry: 850, loop: 4700, exit: 1050 },
    motion: {
      entry: '地平线先被白闪吞没，城市剪影短暂过曝，冲击波开始成环扩散',
      loop: '火球抬升为连续云柱、宽云冠与翻滚云团，冲击波按距离掀翻楼群并将全部城市实例逐层抹除',
      exit: '焦土地表与核尘埃吞没残景，TOTAL ANNIHILATION 确认后从暗红余辉回收',
      camera: '爆闪瞬间急推和重震，随后跟随蘑菇云抬升做缓慢回稳',
    },
  },
  {
    key: 'galaxyMap',
    label: '全息星图',
    codename: 'ASTRO CHART',
    narrative: '星点分层升起缓旋，星座连线逐段生长，目标锁定。',
    cost: 12,
    tier: 'singularity',
    icon: Telescope,
    tone: '#818cf8',
    accent: '#93c5fd',
    secondary: '#818cf8',
    backdrop:
      'radial-gradient(circle at 50% 40%, rgba(129, 140, 248, 0.18), transparent 44%), linear-gradient(180deg, rgba(2, 6, 23, 0.78), rgba(30, 27, 75, 0.3))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 700, loop: 4050, exit: 850 },
    motion: {
      entry: '数百星点自底部升起入场，按深度分层成伪 3D 视差',
      loop: '星图整体绕心缓旋，seed 选定星座连线逐段生长并标注代号',
      exit: '目标星放大脉冲 + 三重锁定环弹出坐标，星图上收淡出',
      camera: '天文台式缓推，凝视星图纵深',
    },
  },
  {
    key: 'solarFlare',
    label: '日冕风暴',
    codename: 'CLASS-X FLARE',
    narrative: '磁力线断裂抛射日冕物质，粒子风掠过全屏舷窗。',
    cost: 12,
    tier: 'singularity',
    icon: Sun,
    tone: '#fb923c',
    accent: '#fb923c',
    secondary: '#93c5fd',
    backdrop:
      'radial-gradient(circle at 8% 92%, rgba(251, 146, 60, 0.3), transparent 44%), linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(67, 20, 7, 0.28))',
    camera: 'sweep',
    shake: 1,
    phases: { entry: 700, loop: 4050, exit: 850 },
    motion: {
      entry: '左下巨日边缘显影，日面颗粒对流沸腾',
      loop: '磁力线贝塞尔弧逐条亮起拉出等离子环，2s 断裂瞬间 CME 大团抛射冲向对角',
      exit: '粒子风掠过全屏，右上泛起极光帘余韵',
      camera: '沿抛射方向的对角横移，抵达时轻震',
    },
  },
  {
    key: 'nanoSwarm',
    label: '纳米蜂群',
    codename: 'NANITE BLOOM',
    narrative: '微粒虫群受令聚形签到印记，任务完成四散退场。',
    cost: 12,
    tier: 'singularity',
    icon: ComponentIcon,
    tone: '#a3e635',
    accent: '#4ade80',
    secondary: '#a3e635',
    backdrop:
      'radial-gradient(circle at center, rgba(163, 230, 53, 0.14), transparent 44%), linear-gradient(180deg, rgba(2, 6, 23, 0.76), rgba(26, 46, 5, 0.3))',
    camera: 'warp',
    shake: 0,
    phases: { entry: 650, loop: 4250, exit: 900 },
    motion: {
      entry: '四周涌入数百绿金微粒，虫群般游弋汇集',
      loop: '1.8s 粒子受采样点弹簧引力收敛，拼出发光「已签到」并呼吸抖动',
      exit: '集体炸散成光条四散逃逸，残留萤光明灭',
      camera: '聚形时收缩、解散时舒张的尺度呼吸',
    },
  },
  {
    key: 'holoDisassemble',
    label: '全息拆解',
    codename: 'EXPLODED VIEW',
    narrative: '构件分层剥离悬浮标注，回吸合体时纵向光柱贯穿。',
    cost: 12,
    tier: 'singularity',
    icon: Boxes,
    tone: '#7dd3fc',
    accent: '#7dd3fc',
    secondary: '#a78bfa',
    backdrop:
      'radial-gradient(circle at center, rgba(125, 211, 252, 0.18), transparent 40%), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(12, 74, 110, 0.26))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 600, loop: 4150, exit: 850 },
    motion: {
      entry: '中心全息件通电成型，检修弧线环绕',
      loop: '多层部件分离位移旋转悬浮，剥离迸出碎屑，引出标注线 + 部件编号逐一浮现',
      exit: '部件回吸合体，合体瞬间冲击环 + 纵向光柱 UPGRADED',
      camera: '工程检视推镜，绕拆解体缓移',
    },
  },
  {
    key: 'rocketLaunch',
    label: '曙光发射',
    codename: 'DAWN ASCENT',
    narrative: '倒计时冲击，点火烈焰反溅，箭体拖焰冲出屏顶。',
    cost: 12,
    tier: 'singularity',
    icon: Rocket,
    tone: '#f97316',
    accent: '#fb923c',
    secondary: '#93c5fd',
    backdrop:
      'radial-gradient(circle at 50% 86%, rgba(249, 115, 22, 0.24), transparent 40%), linear-gradient(180deg, rgba(2, 6, 23, 0.74), rgba(28, 25, 23, 0.34))',
    camera: 'ascend',
    shake: 2,
    phases: { entry: 1000, loop: 4300, exit: 900 },
    motion: {
      entry: '巨型数字 3→2→1 逐个缩放冲击 + 环荡开，发射塔警示灯闪烁',
      loop: '2.2s 点火：高密度橙白火花下喷反溅 + 浓烟横滚；箭体光点拖长尾焰加速升空，级段翻滚抛离',
      exit: '尾迹凝成贯穿光柱 LIFTOFF 定格后消散',
      camera: '仰角跟升长镜头，点火全程低幅震屏',
    },
  },
  {
    key: 'supernova',
    label: '超新星爆发',
    codename: 'NOVA CASCADE',
    narrative: '恒星坍缩静默一拍，三段光谱波次炸成永恒星云。',
    cost: 13,
    tier: 'singularity',
    apex: true,
    icon: Star,
    tone: '#f59e0b',
    accent: '#fb923c',
    secondary: '#93c5fd',
    backdrop:
      'radial-gradient(circle at center, rgba(245, 158, 11, 0.24), transparent 38%), linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(69, 26, 3, 0.26))',
    camera: 'collapse',
    shake: 2,
    phases: { entry: 800, loop: 4100, exit: 900 },
    motion: {
      entry: '恒星呼吸膨胀，表面对流沸腾，日珥随机腾起',
      loop: '2s 急缩坍缩成白点、全场星尘瞬间吸入、静默一拍；随后 300+ 粒三波次三色光谱爆发 + 冲击环推开星尘',
      exit: '残骸凝成星云驻留，尘埃缓散闪烁至熄灭',
      camera: '坍缩时加速吸入，爆发瞬间反弹回冲 + 重震',
    },
  },
  {
    key: 'aiAwaken',
    label: '觉醒之眼',
    codename: 'SENTIENCE DAWN',
    narrative: '代码汇入黑暗，巨大虹膜通电睁眼，注视签到者。',
    cost: 13,
    tier: 'singularity',
    apex: true,
    icon: Eye,
    tone: '#f472b6',
    accent: '#c084fc',
    secondary: '#f472b6',
    backdrop:
      'radial-gradient(circle at center, rgba(244, 114, 182, 0.18), transparent 40%), linear-gradient(180deg, rgba(1, 2, 8, 0.86), rgba(80, 7, 36, 0.24))',
    camera: 'dolly',
    shake: 0,
    phases: { entry: 800, loop: 4250, exit: 950 },
    motion: {
      entry: '黑暗中四周代码流拖尾向心汇入，速度渐快',
      loop: '1.8s 睁眼：多层同心弧段虹膜反向旋转、纹路通电逐段点亮、瞳孔收缩定焦；瞳中浮现签到数据环绕',
      exit: '上下暗幕合拢眨眼熄灭，只余一点余光 CONSCIOUSNESS ONLINE',
      camera: '被注视感的缓推，定焦瞬间静止',
    },
  },
  {
    key: 'dysonRing',
    label: '戴森星环',
    codename: 'DYSON ARRAY',
    narrative: '环带构件绕恒星逐段点亮，合拢瞬间能量向外输送。',
    cost: 13,
    tier: 'singularity',
    apex: true,
    icon: Globe,
    tone: '#facc15',
    accent: '#facc15',
    secondary: '#fb923c',
    backdrop:
      'radial-gradient(circle at center, rgba(250, 204, 21, 0.2), transparent 36%), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(66, 32, 6, 0.3))',
    camera: 'dolly',
    shake: 1,
    phases: { entry: 750, loop: 4150, exit: 900 },
    motion: {
      entry: '中央恒星燃烧显影，星野缓漂，施工无人机就位',
      loop: '发光构件沿透视椭圆轨道逐段建造点亮（近大远小伪 3D），无人机拖尾穿梭补给',
      exit: '全环合拢瞬间泛白，能量光束向两侧扫出 MEGASTRUCTURE ONLINE',
      camera: '工程全景缓推，合拢供能瞬间轻震',
    },
  },
  {
    key: 'blackHole',
    label: '奇点坍缩',
    codename: 'SINGULARITY COLLAPSE',
    narrative: '星光螺旋坠入事件视界，静默之后白洞反弹喷流对射。',
    cost: 14,
    tier: 'singularity',
    apex: true,
    icon: Eclipse,
    tone: '#fb923c',
    accent: '#fb923c',
    secondary: '#93c5fd',
    backdrop:
      'radial-gradient(circle at center, rgba(251, 146, 60, 0.16), rgba(2, 6, 23, 0.78) 40%, rgba(2, 6, 23, 0.5)), linear-gradient(180deg, rgba(2, 6, 23, 0.72), rgba(23, 12, 4, 0.4))',
    camera: 'none',
    shake: 0,
    phases: { entry: 700, loop: 4300, exit: 1000 },
    motion: {
      entry: '星野铺场，倾斜吸积盘多层旋转显影',
      loop: '外围星光被引力拉成螺旋坠入（角速度随半径暴增），2.2s 视界收缩光子环驻留、画面静默半拍；3.6s 白洞闪爆 + 上下相对论喷流 + 三重冲击环',
      exit: '余烬缓散，EVENT HORIZON 熄灭归黑',
      camera: '组件自带镜头：吸入推近 → 静默收缩 → 反弹回冲（舞台不叠加）',
    },
  },
  {
    key: 'gravityWave',
    label: '引力波合并',
    codename: 'SPACETIME MERGER',
    narrative: '双星互绕衰减合并，白闪之后时空网格三波涟漪。',
    cost: 14,
    tier: 'singularity',
    apex: true,
    icon: Waves,
    tone: '#93c5fd',
    accent: '#93c5fd',
    secondary: '#818cf8',
    backdrop:
      'radial-gradient(circle at center, rgba(147, 197, 253, 0.2), transparent 42%), linear-gradient(180deg, rgba(2, 6, 23, 0.74), rgba(30, 58, 138, 0.2))',
    camera: 'collapse',
    shake: 1,
    phases: { entry: 800, loop: 4400, exit: 1000 },
    motion: {
      entry: '双中子星互绕入场，双螺旋拖尾光圈成形',
      loop: '轨道逐圈衰减转速递增；2.6s 合并白闪 + 千新星金红抛射；极坐标时空网格显影，径向波扭曲网格线三波传出',
      exit: '涟漪渐弱，星点相位抖动平息归寂',
      camera: '被引力场拖拽的缓慢吸入，合并瞬间回冲 + 轻震',
    },
  },
  {
    key: 'riftTear',
    label: '时空裂隙',
    codename: 'DIMENSION TEAR',
    narrative: '应力撕开锯齿裂缝，异界符文被吸出，缝合回弹。',
    cost: 14,
    tier: 'singularity',
    apex: true,
    icon: Slice,
    tone: '#c084fc',
    accent: '#c084fc',
    secondary: '#f472b6',
    backdrop:
      'radial-gradient(circle at center, rgba(192, 132, 252, 0.22), transparent 36%), linear-gradient(180deg, rgba(2, 6, 23, 0.78), rgba(59, 7, 100, 0.3))',
    camera: 'punch',
    shake: 1,
    phases: { entry: 700, loop: 4350, exit: 950 },
    motion: {
      entry: '画面细微应力抖动，细光缝折线蔓延，暗紫微粒聚集',
      loop: '1.8s 锯齿裂缝轰然张开（外紫内白双描边、缝内异次元发光），卢恩符文与碎片被吸出悬浮，缝缘火花迸溅',
      exit: '一点光沿缝缘扫过拉合裂缝，空间回弹环波，残符淡出',
      camera: '撕裂瞬间急推 + 震屏，缝合时回稳',
    },
  },
] as const;

export const EFFECT_OPTION_MAP: Record<RewardEffectKey, RewardEffectOption> = Object.fromEntries(
  EFFECT_OPTIONS.map((option): [RewardEffectKey, RewardEffectOption] => [option.key, option])
) as Record<RewardEffectKey, RewardEffectOption>;

/** 总时长 = entry + loop + exit。数值与三期重构前逐 ms 一致，组件内部编排不受影响 */
export const EFFECT_DURATIONS: Record<RewardEffectKey, number> = Object.fromEntries(
  EFFECT_OPTIONS.map((option): [RewardEffectKey, number] => [
    option.key,
    option.phases.entry + option.phases.loop + option.phases.exit,
  ])
) as Record<RewardEffectKey, number>;

/** 按分级（奇点 → 战术 → 信标）分组，组内按甲币降序，供商店渲染 */
export function groupEffectsByTier(): Array<{ meta: EffectTierMeta; options: RewardEffectOption[] }> {
  const order: EffectTierKey[] = ['singularity', 'tactical', 'signal'];
  return order.map((tierKey) => ({
    meta: EFFECT_TIERS[tierKey],
    options: EFFECT_OPTIONS.filter((option) => option.tier === tierKey).sort(
      (a, b) => b.cost - a.cost || a.label.localeCompare(b.label, 'zh')
    ),
  }));
}
