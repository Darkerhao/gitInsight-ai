import type { AppEdition } from './types.js';

declare const __APP_EDITION__: AppEdition | undefined;
declare const __APP_EDITION_LABEL__: string | undefined;
declare const __APP_PRODUCT_NAME__: string | undefined;

const definedEdition = typeof __APP_EDITION__ === 'string' ? __APP_EDITION__ : 'lite';

export const APP_EDITION: AppEdition = definedEdition === 'standard' ? 'standard' : 'lite';
export const APP_EDITION_LABEL =
  typeof __APP_EDITION_LABEL__ === 'string' ? __APP_EDITION_LABEL__ : APP_EDITION === 'standard' ? '标准版' : '简洁版';
export const APP_PRODUCT_NAME =
  typeof __APP_PRODUCT_NAME__ === 'string' ? __APP_PRODUCT_NAME__ : `GitInsight AI ${APP_EDITION === 'standard' ? 'Standard' : 'Lite'}`;
