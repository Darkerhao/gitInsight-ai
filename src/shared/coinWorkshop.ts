import type { CheckinWalletSnapshot } from './types.js';

export interface CoinShopItem {
  id: string;
  kind: 'theme' | 'seed' | 'pot' | 'card' | 'scene';
  name: string;
  description: string;
  price: number;
  accent?: string;
  growthDays?: number;
}

export const COIN_SHOP_ITEMS: CoinShopItem[] = [
  { id: 'scene-desk', kind: 'scene', name: '简洁书桌', description: '一盏灯，一张桌，把此刻留给手头的事。', price: 0 },
  { id: 'scene-rain', kind: 'scene', name: '雨夜', description: '窗外细雨与城市微光，陪你安静投入。', price: 1000000 },
  { id: 'scene-cafe', kind: 'scene', name: '咖啡馆', description: '暖灯、木桌与一杯咖啡，留出自己的角落。', price: 2000000 },
  { id: 'scene-space', kind: 'scene', name: '宇宙舱', description: '隔着舷窗看星球，让思绪专注于眼前。', price: 3000000 },
  { id: 'card-paper', kind: 'card', name: '时光纸笺', description: '暖纸肌理、山形藏印，把日常酿成值得珍藏的时光。', price: 500000, accent: '#faf4e8' },
  { id: 'card-blueprint', kind: 'card', name: '工程蓝图', description: '精密网格、立体构筑，为每一次交付留下工程印记。', price: 1000000, accent: '#102f4c' },
  { id: 'card-orbit', kind: 'card', name: '星轨纪念', description: '深空微光、虹彩星环，让持续的投入拥有自己的引力。', price: 2000000, accent: '#231e3d' },
  { id: 'theme-default', kind: 'theme', name: '原野绿', description: '熟悉的清新绿色，随时免费切换。', price: 0, accent: '#b9f36b' },
  { id: 'theme-ocean', kind: 'theme', name: '深海蓝', description: '把海风的清爽带进工作台。', price: 1000000, accent: '#58c8ed' },
  { id: 'theme-lavender', kind: 'theme', name: '暮光紫', description: '安静的紫色，留一份沉稳给专注时刻。', price: 2000000, accent: '#b9a0ff' },
  { id: 'theme-sunset', kind: 'theme', name: '落日橙', description: '用温暖的日落色记录一天的收获。', price: 3000000, accent: '#f5ad73' },
  { id: 'seed-clover', kind: 'seed', name: '幸运三叶草', description: '记录三个工作日，收获一份小小幸运。', price: 200000, growthDays: 3 },
  { id: 'seed-sunflower', kind: 'seed', name: '向日葵', description: '记录五个工作日，让坚持开成花。', price: 400000, growthDays: 5 },
  { id: 'seed-pine', kind: 'seed', name: '常青松', description: '记录七个工作日，收藏一棵常青树。', price: 800000, growthDays: 7 },
  { id: 'pot-default', kind: 'pot', name: '朴素陶盆', description: '简单自然的免费基础花盆。', price: 0 },
  { id: 'pot-ceramic', kind: 'pot', name: '白瓷花盆', description: '细腻白瓷，为整个花园换上新装。', price: 500000 },
  { id: 'pot-orbit', kind: 'pot', name: '星环花盆', description: '一圈星轨，盛放每一份坚持。', price: 1500000 },
];

export interface CoinGardenPlant {
  id: number;
  seedId: string;
  plantedAt: string;
  harvestedAt: string | null;
  growthDays: number;
  requiredDays: number;
}

export interface CoinWorkshopSnapshot {
  wallet: CheckinWalletSnapshot;
  ownedItemIds: string[];
  equippedThemeId: string;
  equippedPotId: string;
  plants: CoinGardenPlant[];
  summary: { todayIncome: number; todaySpent: number; totalIncome: number; totalSpent: number };
}

export interface CoinTransaction {
  id: number;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  refKey: string | null;
  createdAt: string;
}

export interface CoinTransactionQuery {
  page?: number;
  pageSize?: number;
  type?: 'all' | 'income' | 'spend';
}

export interface CoinTransactionPage {
  records: CoinTransaction[];
  total: number;
  page: number;
  pageSize: number;
}
