import React from 'react';
import { Agent, AgentStatus } from '../types';
import './AgentDashboard.css';

interface AgentDashboardProps {
  agent: Agent;
  isConnected: boolean;
  onStatusChange: (status: AgentStatus) => void;
  onLogout: () => void;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({
  agent,
  isConnected,
  onStatusChange,
  onLogout,
}) => {
  const getStatusColor = (status: AgentStatus): string => {
    switch (status) {
      case AgentStatus.AVAILABLE:
        return '#10b981';
      case AgentStatus.BUSY:
        return '#f59e0b';
      case AgentStatus.IN_CALL:
        return '#ef4444';
      case AgentStatus.OFFLINE:
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: AgentStatus): string => {
    switch (status) {
      case AgentStatus.AVAILABLE:
        return 'Available';
      case AgentStatus.BUSY:
        return 'Busy';
      case AgentStatus.IN_CALL:
        return 'In Call';
      case AgentStatus.OFFLINE:
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="agent-info">
          <h1>Welcome, {agent.name}</h1>
          <p className="agent-email">{agent.email}</p>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '● Connected' : '● Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="status-section">
          <h2>Status Control</h2>
          <div className="status-card">
            <div className="current-status">
              <span className="status-label">Current Status:</span>
              <span 
                className="status-badge" 
                style={{ backgroundColor: getStatusColor(agent.status) }}
              >
                {getStatusText(agent.status)}
              </span>
            </div>
            
            <div className="status-buttons">
              <button
                className={`status-button ${agent.status === AgentStatus.AVAILABLE ? 'active' : ''}`}
                onClick={() => onStatusChange(AgentStatus.AVAILABLE)}
                disabled={agent.status === AgentStatus.IN_CALL}
              >
                Available
              </button>
              <button
                className={`status-button ${agent.status === AgentStatus.BUSY ? 'active' : ''}`}
                onClick={() => onStatusChange(AgentStatus.BUSY)}
                disabled={agent.status === AgentStatus.IN_CALL}
              >
                Busy
              </button>
              <button
                className={`status-button ${agent.status === AgentStatus.OFFLINE ? 'active' : ''}`}
                onClick={() => onStatusChange(AgentStatus.OFFLINE)}
                disabled={agent.status === AgentStatus.IN_CALL}
              >
                Offline
              </button>
            </div>
          </div>
        </div>

        <div className="statistics-section">
          <h2>Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{agent.statistics.totalCalls}</div>
              <div className="stat-label">Total Calls</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-value">{agent.statistics.callsToday}</div>
              <div className="stat-label">Calls Today</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-value">
                {formatDuration(Math.round(agent.statistics.averageCallDuration))}
              </div>
              <div className="stat-label">Avg Call Duration</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-value">
                {formatDuration(agent.statistics.totalCallDuration)}
              </div>
              <div className="stat-label">Total Call Time</div>
            </div>
          </div>
        </div>

        {agent.currentCallId && (
          <div className="current-call-section">
            <h2>Current Call</h2>
            <div className="call-info">
              <p>Call ID: {agent.currentCallId}</p>
              <p>Status: In Progress</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};