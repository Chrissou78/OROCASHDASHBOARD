// HoldersPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { fetchTokenHolders } from '../utils/api';
import './HoldersPage.css';

function HoldersPage({ contract, provider, tokenData, onBack }) {
  const [loading, setLoading] = useState(true);
  const [holders, setHolders] = useState([]);
  const [filteredHolders, setFilteredHolders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('balance-desc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalSupply: '0',
    formattedSupply: '0',
    totalHolders: 0,
    topHolderPercent: 0
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchHolders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch total supply from contract
      const totalSupply = await contract.totalSupply();
      const formattedSupply = ethers.formatUnits(totalSupply, tokenData.decimals);

      // Fetch token transfers from PolygonScan API V2
      const transfers = await fetchTokenHolders();

      // Handle "No transactions found" case
      if (!transfers || transfers.length === 0) {
        console.log('No token transfers found - contract may be newly deployed');
        setStats({
          totalSupply: totalSupply.toString(),
          formattedSupply,
          totalHolders: 0,
          topHolderPercent: 0
        });
        setHolders([]);
        setFilteredHolders([]);
        setLoading(false);
        return;
      }

      // Process token transfers to calculate balances
      const holdersMap = new Map();

      transfers.forEach(tx => {
        const { from, to, value } = tx;
        const bigValue = BigInt(value);

        // Update sender balance
        if (from && from !== '0x0000000000000000000000000000000000000000') {
          const fromHolder = holdersMap.get(from) || {
            address: from,
            balance: 0n,
            txCount: 0,
            totalIn: 0n,
            totalOut: 0n
          };
          fromHolder.balance = fromHolder.balance - bigValue;
          fromHolder.txCount++;
          fromHolder.totalOut = fromHolder.totalOut + bigValue;
          holdersMap.set(from, fromHolder);
        }

        // Update receiver balance
        if (to && to !== '0x0000000000000000000000000000000000000000') {
          const toHolder = holdersMap.get(to) || {
            address: to,
            balance: 0n,
            txCount: 0,
            totalIn: 0n,
            totalOut: 0n
          };
          toHolder.balance = toHolder.balance + bigValue;
          toHolder.txCount++;
          toHolder.totalIn = toHolder.totalIn + bigValue;
          holdersMap.set(to, toHolder);
        }
      });

      // Filter out zero balance holders and format
      let holdersList = Array.from(holdersMap.values())
        .filter(h => h.balance > 0n)
        .map(h => ({
          ...h,
          formattedBalance: ethers.formatUnits(h.balance, tokenData.decimals),
          formattedTotalIn: ethers.formatUnits(h.totalIn, tokenData.decimals),
          formattedTotalOut: ethers.formatUnits(h.totalOut, tokenData.decimals),
          percentOfSupply: (
            (Number(ethers.formatUnits(h.balance, tokenData.decimals)) / 
              Number(formattedSupply)) * 100
          ).toFixed(4)
        }));

      // Sort by balance descending
      holdersList.sort((a, b) => 
        BigInt(b.balance) - BigInt(a.balance)
      );

      // Calculate top holder percentage
      const topHolderPercent = holdersList.length > 0 
        ? parseFloat(holdersList[0].percentOfSupply) 
        : 0;

      setStats({
        totalSupply: totalSupply.toString(),
        formattedSupply,
        totalHolders: holdersList.length,
        topHolderPercent
      });

      setHolders(holdersList);
      applyFiltersAndSort(holdersList, searchQuery, sortBy);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error("Error fetching holders:", err);
      // Don't treat "No transactions found" as an error
      if (err.message === 'No transactions found') {
        setStats({
          totalSupply: '0',
          formattedSupply: '0',
          totalHolders: 0,
          topHolderPercent: 0
        });
        setHolders([]);
        setFilteredHolders([]);
        setLoading(false);
      } else {
        setError(err.message || "Failed to fetch holders");
        setLoading(false);
      }
    }
  }, [contract, tokenData.decimals, searchQuery, sortBy]);

  const applyFiltersAndSort = (holdersList, query, sort) => {
    let filtered = holdersList;

    // Search filter
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(h => 
        h.address.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort
    switch (sort) {
      case 'balance-desc':
        filtered.sort((a, b) => BigInt(b.balance) - BigInt(a.balance));
        break;
      case 'balance-asc':
        filtered.sort((a, b) => BigInt(a.balance) - BigInt(b.balance));
        break;
      case 'txcount-desc':
        filtered.sort((a, b) => b.txCount - a.txCount);
        break;
      default:
        break;
    }

    setCurrentPage(1);
    setFilteredHolders(filtered);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    applyFiltersAndSort(holders, value, sortBy);
  };

  const handleSort = (value) => {
    setSortBy(value);
    applyFiltersAndSort(holders, searchQuery, value);
  };

  useEffect(() => {
    fetchHolders();
  }, [fetchHolders]);

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedHolders = filteredHolders.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredHolders.length / pageSize);

  if (error) {
    return (
      <div className="holders-page">
        <header className="page-header">
          <button onClick={onBack} className="back-btn">← Back to Dashboard</button>
          <h1>📊 Token Holders</h1>
        </header>
        <div className="error-box">
          <h3>⚠️ Error Loading Holders</h3>
          <p>{error}</p>
          <button onClick={fetchHolders} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="holders-page">
      {/* Header */}
      <header className="page-header">
        <button onClick={onBack} className="back-btn">← Back to Dashboard</button>
        <div className="header-info">
          <h1>📊 Token Holders</h1>
          <p className="subtitle">{tokenData.symbol} - Orocash</p>
        </div>
        <div className="header-actions">
          <span className="last-update">Updated: {lastUpdate.toLocaleTimeString()}</span>
          <button onClick={fetchHolders} className="refresh-btn">🔄 Refresh</button>
        </div>
      </header>

      {/* Stats */}
      <div className="holders-stats">
        <StatCard
          title="Total Holders"
          value={stats.totalHolders}
          icon="👥"
        />
        <StatCard
          title="Total Supply"
          value={parseFloat(stats.formattedSupply).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          unit={tokenData.symbol}
          icon="📦"
        />
        <StatCard
          title="Top Holder"
          value={stats.topHolderPercent}
          unit="%"
          icon="👑"
        />
        <StatCard
          title="Unique Addresses"
          value={filteredHolders.length}
          icon="🔍"
        />
      </div>

      {/* Filters and Search */}
      <div className="holders-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by address..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="controls-group">
          <div className="control">
            <label>Sort By:</label>
            <select value={sortBy} onChange={(e) => handleSort(e.target.value)}>
              <option value="balance-desc">Highest Balance</option>
              <option value="balance-asc">Lowest Balance</option>
              <option value="txcount-desc">Most Transactions</option>
            </select>
          </div>

          <div className="control">
            <label>Per Page:</label>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading holders from PolygonScan...</p>
          <p className="loading-subtitle">This may take a moment for large datasets</p>
        </div>
      ) : stats.totalHolders === 0 ? (
        <div className="no-data">
          <h3>📊 No Token Transfers Found</h3>
          <p>This contract has no token transfer events recorded on the blockchain yet.</p>
          <p className="no-data-hint">The contract may be newly deployed or transfers may be managed differently.</p>
        </div>
      ) : filteredHolders.length === 0 ? (
        <div className="no-data">
          <p>No holders found matching your search criteria</p>
        </div>
      ) : (
        <>
          {/* Holders Table */}
          <div className="holders-table-container">
            <table className="holders-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  <th>Balance</th>
                  <th>% of Supply</th>
                  <th>Transactions</th>
                  <th>Total In</th>
                  <th>Total Out</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHolders.map((holder, idx) => (
                  <HolderRow
                    key={holder.address}
                    holder={holder}
                    index={startIndex + idx + 1}
                    tokenData={tokenData}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                ← Previous
              </button>

              <div className="pagination-info">
                Page {currentPage} of {totalPages} ({filteredHolders.length} holders)
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, unit, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <p className="stat-title">{title}</p>
        <p className="stat-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="stat-unit">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

function HolderRow({ holder, index, tokenData }) {
  return (
    <tr className="holder-row">
      <td className="rank">{index}</td>
      <td className="address">
        <a 
          href={`https://polygonscan.com/address/${holder.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="address-link"
        >
          {holder.address.slice(0, 10)}...{holder.address.slice(-8)}
        </a>
      </td>
      <td className="balance">{parseFloat(holder.formattedBalance).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
      <td className="percentage">{holder.percentOfSupply}%</td>
      <td className="tx-count">{holder.txCount}</td>
      <td className="total-in">{parseFloat(holder.formattedTotalIn).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
      <td className="total-out">{parseFloat(holder.formattedTotalOut).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
      <td className="view">
        <a 
          href={`https://polygonscan.com/address/${holder.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="view-link"
        >
          View →
        </a>
      </td>
    </tr>
  );
}

export default HoldersPage;
