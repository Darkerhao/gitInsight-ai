import type { CheckinWalletSnapshot } from './types.js';

export interface CoinShopItem {
  id: string;
  kind: 'theme' | 'seed' | 'pot';
  name: string;
  description: string;
  price: number;
  accent?: string;
  growthDays?: number;
}

export const COIN_SHOP_ITEMS: CoinShopItem[] = [
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
