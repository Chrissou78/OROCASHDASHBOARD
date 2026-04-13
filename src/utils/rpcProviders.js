// src/utils/rpcProviders.js
import { ethers } from 'ethers';
import CONFIG from '../config';

// Main provider (Alchemy)
export const mainProvider = new ethers.JsonRpcProvider(CONFIG.POLYGON_RPC);

// Fallback provider for logs (better for free tier)
export const logsProvider = new ethers.JsonRpcProvider('https://rpc.ankr.com/polygon');

export function getProvider() {
  return mainProvider;
}

export function getLogsProvider() {
  return logsProvider;
}
