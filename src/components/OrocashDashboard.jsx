import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import CONFIG from '../config';
import HoldersPage from './HoldersPage';
import { fetchTokenHolders } from '../utils/api';
import MembershipsPage from './MembershipsPage';
import './OrocashDashboard.css';

// Contract ABI
const OROCASH_ABI = [
  "function name() public view returns (string)",
  "function symbol() public view returns (string)",
  "function totalSupply() public view returns (uint256)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
  "function hasFee() public view returns (bool)",
  "function fixedFee() public view returns (uint256)",
  "function percentFeeBps() public view returns (uint256)",
  "function paused() public view returns (bool)",
  "function limitTxEnabled() public view returns (bool)",
  "function custodyEnabled() public view returns (bool)",
  "function minHoldToken() public view returns (uint256)",
  "function custodyLimit() public view returns (uint256)",
  "function Treasury() public view returns (address)",
  "function getRoleMembers(uint8 roleId) public view returns (address[])",
  "function totalMemberships() public view returns (uint256)",
  "function hasMembership(address account) public view returns (bool)",
  "function membershipOf(address account) public view returns (uint256)",
  "function ownerOfMembership(uint256 tokenId) public view returns (address)",
  "event TokenMinted(address indexed to, address indexed approvedBy, uint256 amount)",
  "event TokenBurned(address indexed from, address indexed burnedBy, uint256 amount)",
  "event MembershipMinted(address indexed member, uint256 indexed tokenId, uint256 timestamp)",
  "event MembershipBurned(address indexed member, uint256 indexed tokenId, address indexed burnedBy)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const ROLE_NAMES = {
  0: "Admin",
  1: "Moderator",
  2: "Minter",
  3: "Extractor",
  4: "CFO",
  5: "Whitelist"
};

function OrocashDashboard() {
  // State Management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [tokenHolderCount, setTokenHolderCount] = useState(0);

  // Token Data
  const [tokenData, setTokenData] = useState({
    name: "Orocash",
    symbol: "$ORO",
    totalSupply: "0",
    decimals: 6,
    formattedSupply: "0"
  });

  // Fee Configuration
  const [feeConfig, setFeeConfig] = useState({
    hasFee: false,
    fixedFee: "0",
    percentFeeBps: "0"
  });

  // Contract Status
  const [contractStatus, setContractStatus] = useState({
    paused: false,
    custodyEnabled: false,
    limitTxEnabled: false,
    minHoldToken: "0",
    custodyLimit: "0",
    Treasury: "0x0000000000000000000000000000000000000000"
  });

  // Membership & NFT Data
  const [membershipData, setMembershipData] = useState({
    totalMemberships: "0",
    nftHolders: "0"
  });

  // Role Members
  const [roleMembers, setRoleMembers] = useState({
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: []
  });

  // Create provider once and reuse it
  const providerRef = React.useRef(null);
  const contractRef = React.useRef(null);

  React.useEffect(() => {
    if (!providerRef.current) {
      providerRef.current = new ethers.JsonRpcProvider(
        CONFIG.POLYGON_RPC,
        137 // Polygon Mainnet chain ID
      );
      contractRef.current = new ethers.Contract(
        CONFIG.CONTRACT_ADDRESS,
        OROCASH_ABI,
        providerRef.current
      );
    }
  }, []);

  // Initialize Contract Data
  const initializeContract = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const contract = contractRef.current;
      const provider = providerRef.current;

      if (!contract || !provider) {
        throw new Error("Provider not initialized");
      }

      // Fetch Token Data
      const [name, symbol, totalSupply, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.totalSupply(),
        contract.decimals()
      ]);

      const formattedSupply = ethers.formatUnits(totalSupply, decimals);
      setTokenData({
        name,
        symbol,
        totalSupply: totalSupply.toString(),
        decimals,
        formattedSupply: parseFloat(formattedSupply).toLocaleString('en-US', { 
          maximumFractionDigits: 2 
        })
      });

      // Fetch Fee Configuration
      const [hasFee, fixedFee, percentFeeBps] = await Promise.all([
        contract.hasFee(),
        contract.fixedFee(),
        contract.percentFeeBps()
      ]);

      setFeeConfig({
        hasFee,
        fixedFee: ethers.formatUnits(fixedFee, decimals),
        percentFeeBps: (parseInt(percentFeeBps) / 100).toFixed(2)
      });

      // Fetch Contract Status
      const [paused, custodyEnabled, limitTxEnabled, minHoldToken, custodyLimit, Treasury] = 
        await Promise.all([
          contract.paused(),
          contract.custodyEnabled(),
          contract.limitTxEnabled(),
          contract.minHoldToken(),
          contract.custodyLimit(),
          contract.Treasury()
        ]);

      setContractStatus({
        paused,
        custodyEnabled,
        limitTxEnabled,
        minHoldToken: ethers.formatUnits(minHoldToken, decimals),
        custodyLimit: ethers.formatUnits(custodyLimit, decimals),
        Treasury
      });

      // Fetch Membership Data
      const totalMemberships = await contract.totalMemberships();
      setMembershipData({
        totalMemberships: totalMemberships.toString(),
        nftHolders: totalMemberships.toString()
      });

      // Fetch Token Holders from API
      try {
        const holders = await fetchTokenHolders();
        setTokenHolderCount(holders.length);
      } catch (err) {
        console.warn('Could not fetch token holders:', err.message);
        setTokenHolderCount(0);
      }

      // Fetch Role Members
      const roleMembersData = {};
      for (let i = 0; i < 6; i++) {
        try {
          const members = await contract.getRoleMembers(i);
          roleMembersData[i] = members;
        } catch (err) {
          console.warn(`Error fetching role ${i}:`, err.message);
          roleMembersData[i] = [];
        }
      }
      setRoleMembers(roleMembersData);

      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error("Dashboard initialization error:", err);
      setError(err.message || "Failed to load dashboard data");
      setLoading(false);
    }
  }, []);

  // Auto-refresh logic
  useEffect(() => {
    initializeContract();
    
    if (autoRefresh) {
      const interval = setInterval(initializeContract, CONFIG.AUTO_REFRESH_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, initializeContract]);

  // Loading State
  if (loading) {
    return (
      <div className="dashboard-container loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Loading Orocash Dashboard...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="dashboard-container error">
        <div className="error-box">
          <h2>⚠️ Dashboard Error</h2>
          <p>{error}</p>
          <button onClick={initializeContract} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render Holders Page
  if (currentPage === 'holders') {
    return (
      <HoldersPage
        contract={contractRef.current}
        provider={providerRef.current}
        tokenData={tokenData}
        onBack={() => setCurrentPage('dashboard')}
      />
    );
  }

  // Render Memberships Page
  if (currentPage === 'memberships') {
    return (
      <MembershipsPage
        contract={contractRef.current}
        provider={providerRef.current}
        tokenData={tokenData}
        membershipData={membershipData}
        onBack={() => setCurrentPage('dashboard')}
      />
    );
  }

  // Main Dashboard
  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="title-section">
            <h1>🪙 Orocash Activity Dashboard</h1>
            <p className="subtitle">Real-time contract analytics on Polygon</p>
          </div>
          <div className="header-controls">
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
            <button onClick={initializeContract} className="refresh-btn">
              🔄 Refresh Now
            </button>
            <span className="last-update">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </header>

      {/* Contract Address */}
      <div className="contract-info">
        <p className="contract-address">
          Contract: <code>{CONFIG.CONTRACT_ADDRESS}</code>
        </p>
      </div>

      {/* Key Metrics Cards */}
      <section className="metrics-grid">
        <MetricCard
          title="Total Supply"
          value={tokenData.formattedSupply}
          unit={tokenData.symbol}
          icon="📊"
          color="gradient-blue"
          onClick={() => setCurrentPage('holders')}
          clickable
        />
        <MetricCard
          title="Token Holders"
          value={tokenHolderCount}
          unit="addresses"
          icon="👥"
          color="gradient-purple"
          onClick={() => setCurrentPage('holders')}
          clickable
        />
        <MetricCard
          title="NFT Members"
          value={membershipData.totalMemberships}
          unit="memberships"
          icon="🎫"
          color="gradient-green"
          onClick={() => setCurrentPage('memberships')}
          clickable
        />
      </section>

      {/* Fee & Configuration Section */}
      <section className="config-section">
        <div className="config-card">
          <h3>💰 Fee Configuration</h3>
          <div className="config-grid">
            <ConfigItem
              label="Fees Active"
              value={feeConfig.hasFee ? "✅ Enabled" : "❌ Disabled"}
              status={feeConfig.hasFee ? "active" : "inactive"}
            />
            <ConfigItem
              label="Fixed Fee"
              value={`${feeConfig.fixedFee} ${tokenData.symbol}`}
            />
            <ConfigItem
              label="Percent Fee"
              value={`${feeConfig.percentFeeBps}%`}
            />
          </div>
        </div>

        <div className="config-card">
          <h3>⚙️ Contract Status</h3>
          <div className="config-grid">
            <ConfigItem
              label="Paused"
              value={contractStatus.paused ? "🔴 Yes" : "🟢 No"}
              status={contractStatus.paused ? "critical" : "healthy"}
            />
            <ConfigItem
              label="Custody Enabled"
              value={contractStatus.custodyEnabled ? "✅ Yes" : "❌ No"}
              status={contractStatus.custodyEnabled ? "active" : "inactive"}
            />
            <ConfigItem
              label="Limit Enabled"
              value={contractStatus.limitTxEnabled ? "✅ Yes" : "❌ No"}
              status={contractStatus.limitTxEnabled ? "active" : "inactive"}
            />
          </div>
        </div>

        <div className="config-card">
          <h3>🔒 Restrictions</h3>
          <div className="config-grid">
            <ConfigItem
              label="Min Hold Token"
              value={`${contractStatus.minHoldToken} ${tokenData.symbol}`}
            />
            <ConfigItem
              label="Custody Limit"
              value={`${contractStatus.custodyLimit} ${tokenData.symbol}`}
            />
            <ConfigItem
              label="Treasury"
              value={contractStatus.Treasury.slice(0, 10) + "..."}
              fullValue={contractStatus.Treasury}
            />
          </div>
        </div>
      </section>

      {/* Role Members Section */}
      <section className="roles-section">
        <h2>👨‍💼 Access Control & Roles</h2>
        <div className="roles-grid">
          {Object.entries(ROLE_NAMES).map(([roleId, roleName]) => (
            <RoleCard
              key={roleId}
              roleId={roleId}
              roleName={roleName}
              members={roleMembers[roleId] || []}
            />
          ))}
        </div>
      </section>

      {/* Membership Data */}
      <section className="membership-section">
        <h2>🎫 NFT Membership System</h2>
        <div className="membership-grid">
          <MembershipCard
            title="Total Memberships Minted"
            value={membershipData.totalMemberships}
            icon="✨"
            onClick={() => setCurrentPage('memberships')}
            clickable
          />
          <MembershipCard
            title="Soulbound NFT Token"
            value="oroNFT"
            icon="🔐"
          />
          <MembershipCard
            title="Transfer Status"
            value="Non-Transferable"
            icon="🚫"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="dashboard-footer">
        <p>
          ⛓️ Polygon Network | 📡 RPC: {CONFIG.POLYGON_RPC.split('/')[2]} | 🔄 Auto-Refresh:{" "}
          {autoRefresh ? "ON" : "OFF"}
        </p>
      </footer>
    </div>
  );
}

// Helper Components
function MetricCard({ title, value, unit, icon, color, onClick, clickable }) {
  return (
    <div 
      className={`metric-card ${color} ${clickable ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <p className="metric-title">{title}</p>
        <p className="metric-value">
          {value} <span className="metric-unit">{unit}</span>
        </p>
      </div>
      {clickable && <div className="metric-arrow">→</div>}
    </div>
  );
}

function ConfigItem({ label, value, status, fullValue }) {
  return (
    <div className={`config-item ${status || ""}`}>
      <span className="config-label">{label}</span>
      <span className="config-value" title={fullValue}>
        {value}
      </span>
    </div>
  );
}

function RoleCard({ roleId, roleName, members }) {
  return (
    <div className="role-card">
      <div className="role-header">
        <h4>{roleName}</h4>
        <span className="role-count">{members.length}</span>
      </div>
      <div className="role-members">
        {members.length > 0 ? (
          <ul>
            {members.slice(0, 3).map((member, idx) => (
              <li key={idx} title={member}>
                {member.slice(0, 8)}...{member.slice(-6)}
              </li>
            ))}
            {members.length > 3 && <li className="more">+{members.length - 3} more</li>}
          </ul>
        ) : (
          <p className="no-members">No members</p>
        )}
      </div>
    </div>
  );
}

function MembershipCard({ title, value, unit, icon, onClick, clickable }) {
  return (
    <div 
      className={`membership-card ${clickable ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="membership-icon">{icon}</div>
      <div className="membership-content">
        <p className="membership-title">{title}</p>
        <p className="membership-value">
          {value} <span className="membership-unit">{unit}</span>
        </p>
      </div>
      {clickable && <div className="membership-arrow">→</div>}
    </div>
  );
}

export default OrocashDashboard;
