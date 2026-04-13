// src/config.js
export const CONFIG = {
  POLYGONSCAN_API_KEY: process.env.REACT_APP_POLYGONSCAN_API_KEY || '',
  CONTRACT_ADDRESS: process.env.REACT_APP_CONTRACT_ADDRESS || '0x4CD6FFD022F3d777425F1f3BBf4DeD66d3eD1Fad',
  POLYGON_RPC: process.env.REACT_APP_POLYGON_RPC || 'https://rpc.ankr.com/polygon',
  POLYGON_RPC: 'https://polygon-mainnet.g.alchemy.com/v2/IoufBRdGO6MKWC6pxqbZW',
  POLYGONSCAN_API: 'https://api.etherscan.io/v2/api',
  // Auto-refresh frequency (1 hour)
  AUTO_REFRESH_INTERVAL_MS: 3600000,
  CACHE_DURATION_MS: 3600000, // 1 hour
  MEMBERSHIPS_CACHE_KEY: 'orocash_memberships_cache',
  
  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_BATCH_SIZE: 100
};

// Validate configuration
if (!CONFIG.POLYGONSCAN_API_KEY) {
  console.warn('⚠️ Warning: REACT_APP_POLYGONSCAN_API_KEY environment variable not set. Some features may not work.');
}

export default CONFIG;