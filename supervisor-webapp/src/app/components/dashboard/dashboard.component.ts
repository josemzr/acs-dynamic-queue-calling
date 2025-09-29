import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil, interval, startWith, switchMap, firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { Agent, Group, Call, SupervisorDashboardData } from '../../models/types';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  dashboardData: SupervisorDashboardData = {
    totalAgents: 0,
    availableAgents: 0,
    busyAgents: 0,
    totalGroups: 0,
    activeCalls: 0,
    totalCallsToday: 0
  };

  agents: Agent[] = [];
  groups: Group[] = [];
  activeCalls: Call[] = [];
  isConnected = false;
  isLoading = true;

  constructor(
    private apiService: ApiService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.connectWebSocket();
    this.loadDashboardData();
    this.setupPeriodicRefresh();
    this.subscribeToWebSocketMessages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  private connectWebSocket(): void {
    this.wsService.connect();
    this.wsService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
      });
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    
    // Load all data in parallel
    Promise.all([
      firstValueFrom(this.apiService.getAllAgents()),
      firstValueFrom(this.apiService.getAllGroups()),
      firstValueFrom(this.apiService.getActiveCalls()),
      firstValueFrom(this.apiService.getStatistics())
    ]).then(([agentsRes, groupsRes, callsRes, statsRes]) => {
      if (agentsRes?.success && agentsRes.data) {
        this.agents = agentsRes.data;
      }
      
      if (groupsRes?.success && groupsRes.data) {
        this.groups = groupsRes.data;
      }
      
      if (callsRes?.success && callsRes.data) {
        this.activeCalls = callsRes.data;
      }
      
      if (statsRes?.success && statsRes.data) {
        this.updateDashboardStats(statsRes.data);
      }
      
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading dashboard data:', error);
      this.isLoading = false;
    });
  }

  private setupPeriodicRefresh(): void {
    // Refresh data every 30 seconds
    interval(30000)
      .pipe(
        startWith(0),
        switchMap(() => this.apiService.getStatistics()),
        takeUntil(this.destroy$)
      )
      .subscribe(response => {
        if (response.success && response.data) {
          this.updateDashboardStats(response.data);
        }
      });
  }

  private subscribeToWebSocketMessages(): void {
    this.wsService.getMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        if (message) {
          this.handleWebSocketMessage(message);
        }
      });
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'agent_created':
      case 'agent_updated':
      case 'agent_deleted':
      case 'agent_status_updated':
        this.refreshAgents();
        break;
      case 'group_created':
      case 'group_updated':
      case 'group_deleted':
        this.refreshGroups();
        break;
      case 'call_incoming':
      case 'call_answered':
      case 'call_ended':
        this.refreshCalls();
        break;
    }
  }

  private refreshAgents(): void {
    this.apiService.getAllAgents().subscribe(response => {
      if (response.success && response.data) {
        this.agents = response.data;
        this.updateAgentStats();
      }
    });
  }

  private refreshGroups(): void {
    this.apiService.getAllGroups().subscribe(response => {
      if (response.success && response.data) {
        this.groups = response.data;
      }
    });
  }

  private refreshCalls(): void {
    this.apiService.getActiveCalls().subscribe(response => {
      if (response.success && response.data) {
        this.activeCalls = response.data;
        this.dashboardData.activeCalls = response.data.length;
      }
    });
  }

  private updateDashboardStats(stats: any): void {
    this.dashboardData = {
      totalAgents: stats.agents?.total || 0,
      availableAgents: stats.agents?.available || 0,
      busyAgents: stats.agents?.busy || 0,
      totalGroups: stats.groups?.total || 0,
      activeCalls: stats.calls?.active || 0,
      totalCallsToday: 0 // This would need to be calculated based on call history
    };
  }

  private updateAgentStats(): void {
    this.dashboardData.totalAgents = this.agents.length;
    this.dashboardData.availableAgents = this.agents.filter(a => a.status === 'available').length;
    this.dashboardData.busyAgents = this.agents.filter(a => a.status === 'busy' || a.status === 'in_call').length;
  }

  getAgentStatusColor(status: string): string {
    switch (status) {
      case 'available':
        return '#4caf50';
      case 'busy':
        return '#ff9800';
      case 'in_call':
        return '#f44336';
      case 'offline':
        return '#9e9e9e';
      default:
        return '#9e9e9e';
    }
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  getGroupName(groupId: string): string {
    const group = this.groups.find(g => g.id === groupId);
    return group ? group.name : 'Unknown Group';
  }

  getAgentName(agentId: string): string {
    const agent = this.agents.find(a => a.id === agentId);
    return agent ? agent.name : 'Unknown Agent';
  }
}