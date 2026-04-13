import CONFIG from '../config';

export const fetchTokenHolders = async () => {
  try {
    const url = `${CONFIG.POLYGONSCAN_API}?chainid=137&module=account&action=tokentx&contractaddress=${CONFIG.CONTRACT_ADDRESS}&startblock=0&endblock=999999999&sort=asc&apikey=${CONFIG.POLYGONSCAN_API_KEY}`;
    
    console.log('Fetching from:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Full API Response:', data);
    
    if (data.status !== '1') {
      throw new Error(data.message || 'API Error');
    }
    
    const holders = {};
    if (data.result && Array.isArray(data.result)) {
      data.result.forEach(tx => {
        const from = tx.from.toLowerCase();
        const to = tx.to.toLowerCase();
        const amount = BigInt(tx.value);
        
        holders[from] = (holders[from] || 0n) - amount;
        holders[to] = (holders[to] || 0n) + amount;
      });
    }
    
    return Object.entries(holders)
      .map(([address, balance]) => ({
        address,
        balance: balance.toString()
      }))
      .filter(h => BigInt(h.balance) > 0n)
      .sort((a, b) => BigInt(b.balance) - BigInt(a.balance));
      
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
};

export const fetchTokenInfo = async () => {
  try {
    const url = `${CONFIG.POLYGONSCAN_API}?chainid=137&module=account&action=tokentx&contractaddress=${CONFIG.CONTRACT_ADDRESS}&startblock=0&endblock=1&apikey=${CONFIG.POLYGONSCAN_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.result && data.result.length > 0) {
      const tx = data.result[0];
      return {
        name: tx.tokenName,
        symbol: tx.tokenSymbol,
        decimals: tx.tokenDecimal
      };
    }
    return {};
  } catch (error) {
    console.error('Error fetching token info:', error);
    return {};
  }
};

export const fetchTokenMetadata = async () => {
  return fetchTokenInfo();
};
