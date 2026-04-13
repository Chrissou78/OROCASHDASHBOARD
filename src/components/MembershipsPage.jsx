// MembershipsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import CONFIG from '../config';
import './MembershipsPage.css';

function MembershipsPage({ contract, provider, tokenData, membershipData, onBack }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('tokenid-desc');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalMinted: 0,
    currentActive: 0,
    cachedUpTo: 0
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Load cached memberships from localStorage
  const loadCachedMemberships = useCallback(() => {
    try {
      const cached = localStorage.getItem(CONFIG.MEMBERSHIPS_CACHE_KEY);
      if (cached) {
        const { data, upTo, timestamp } = JSON.parse(cached);
        // Cache is valid if less than configured duration
        const isValid = (Date.now() - timestamp) < CONFIG.CACHE_DURATION_MS;
        if (isValid) {
          return { data, upTo };
        }
      }
    } catch (err) {
      console.warn("Error loading cache:", err);
    }
    return { data: {}, upTo: 0 };
  }, []);

  const saveCachedMemberships = useCallback((data, upTo) => {
    try {
      localStorage.setItem(CONFIG.MEMBERSHIPS_CACHE_KEY, JSON.stringify({
        data,
        upTo,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.warn("Error saving cache:", err);
    }
  }, []);

  const fetchMemberships = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load cached data
      const { data: cachedData, upTo: cachedUpTo } = loadCachedMemberships();

      // Get total memberships from contract
      const totalMemberships = await contract.totalMemberships();
      const totalMint = parseInt(totalMemberships);

      // If we already have cached data for this token ID, skip fetching
      let membershipMap = { ...cachedData };
      const startFrom = cachedUpTo > 0 ? cachedUpTo : 1;

      // Fetch new memberships (only if there are new ones)
      if (startFrom <= totalMint) {
        console.log(`Fetching memberships from ${startFrom} to ${totalMint}`);
        
        // Create array of promises for concurrent fetching
        const promises = [];
        for (let i = startFrom; i <= totalMint; i++) {
          promises.push(
            contract.ownerOfMembership(i)
              .then(owner => ({ tokenId: i, owner }))
              .catch(err => {
                console.warn(`Error fetching membership ${i}:`, err);
                return null;
              })
          );
        }

        // Fetch with concurrency control (10 at a time)
        const batchSize = 10;
        for (let i = 0; i < promises.length; i += batchSize) {
          const batch = promises.slice(i, i + batchSize);
          const results = await Promise.all(batch);
          
          results.forEach(result => {
            if (result) {
              membershipMap[result.tokenId.toString()] = {
                tokenId: result.tokenId.toString(),
                address: result.owner,
                status: '🟢 Active'
              };
            }
          });
        }

        // Save updated cache
        saveCachedMemberships(membershipMap, totalMint);
      }

      // Convert to array
      let membershipList = Object.values(membershipMap)
        .sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));

      setMembers(membershipList);
      setStats({
        totalMinted: totalMint,
        currentActive: membershipList.length,
        cachedUpTo: totalMint
      });

      applyFiltersAndSort(membershipList, searchQuery, sortBy);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error("Error fetching memberships:", err);
      setError(err.message || "Failed to fetch memberships");
      setLoading(false);
    }
  }, [contract, searchQuery, sortBy, loadCachedMemberships, saveCachedMemberships]);

  const applyFiltersAndSort = (membershipList, query, sort) => {
    let filtered = membershipList;

    // Search filter
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(m => 
        m.address.toLowerCase().includes(lowerQuery) ||
        m.tokenId.includes(query)
      );
    }

    // Sort
    switch (sort) {
      case 'tokenid-desc':
        filtered.sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));
        break;
      case 'tokenid-asc':
        filtered.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));
        break;
      default:
        break;
    }

    setCurrentPage(1);
    setFilteredMembers(filtered);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    applyFiltersAndSort(members, value, sortBy);
  };

  const handleSort = (value) => {
    setSortBy(value);
    applyFiltersAndSort(members, searchQuery, value);
  };

  const clearCache = () => {
    localStorage.removeItem(CONFIG.MEMBERSHIPS_CACHE_KEY);
    fetchMemberships();
  };

  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  // Pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredMembers.length / pageSize);

  if (error) {
    return (
      <div className="memberships-page">
        <header className="page-header">
          <button onClick={onBack} className="back-btn">← Back to Dashboard</button>
          <h1>🎫 NFT Memberships</h1>
        </header>
        <div className="error-box">
          <h3>⚠️ Error Loading Memberships</h3>
          <p>{error}</p>
          <button onClick={fetchMemberships} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="memberships-page">
      {/* Header */}
      <header className="page-header">
        <button onClick={onBack} className="back-btn">← Back to Dashboard</button>
        <div className="header-info">
          <h1>🎫 NFT Memberships (Soulbound)</h1>
          <p className="subtitle">oroNFT - Immutable Membership Tokens</p>
        </div>
        <div className="header-actions">
          <span className="last-update">Updated: {lastUpdate.toLocaleTimeString()}</span>
          <button onClick={fetchMemberships} className="refresh-btn">🔄 Refresh</button>
          <button onClick={clearCache} className="clear-cache-btn" title="Clear cache and fetch all">🗑️</button>
        </div>
      </header>

      {/* Stats */}
      <div className="membership-stats">
        <StatCard
          title="Total Minted"
          value={stats.totalMinted}
          icon="✨"
          color="blue"
        />
        <StatCard
          title="Currently Active"
          value={stats.currentActive}
          icon="🟢"
          color="green"
        />
        <StatCard
          title="Cached Up To"
          value={`#${stats.cachedUpTo}`}
          icon="💾"
          color="orange"
          subtitle="Token ID"
        />
      </div>

      {/* Filters and Search */}
      <div className="membership-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by address or token ID..."
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
              <option value="tokenid-desc">Highest Token ID (Newest)</option>
              <option value="tokenid-asc">Lowest Token ID (Oldest)</option>
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
          <p>Loading memberships from contract...</p>
          <p className="loading-subtitle">Cached up to: #{stats.cachedUpTo}</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="no-data">
          <p>No memberships found matching your criteria</p>
        </div>
      ) : (
        <>
          {/* Memberships Table */}
          <div className="memberships-table-container">
            <table className="memberships-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Token ID</th>
                  <th>Member Address</th>
                  <th>Status</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMembers.map((member, idx) => (
                  <MembershipRow
                    key={member.tokenId}
                    member={member}
                    index={startIndex + idx + 1}
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
                Page {currentPage} of {totalPages} ({filteredMembers.length} memberships)
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

function StatCard({ title, value, unit, icon, color, subtitle }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <p className="stat-title">{title}</p>
        <p className="stat-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="stat-unit">{unit}</span>}
        </p>
        {subtitle && <p className="stat-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

function MembershipRow({ member, index }) {
  return (
    <tr className="membership-row active">
      <td className="rank">{index}</td>
      <td className="token-id">#{member.tokenId}</td>
      <td className="address">
        <a 
          href={`https://polygonscan.com/address/${member.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="address-link"
        >
          {member.address.slice(0, 10)}...{member.address.slice(-8)}
        </a>
      </td>
      <td className="status">{member.status}</td>
      <td className="view">
        <a 
          href={`https://polygonscan.com/address/${member.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="view-link"
        >
          View on PolygonScan →
        </a>
      </td>
    </tr>
  );
}

export default MembershipsPage;
