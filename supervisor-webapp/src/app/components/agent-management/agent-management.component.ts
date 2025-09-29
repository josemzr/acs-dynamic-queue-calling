import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Agent, Group, CreateAgentRequest, UpdateAgentRequest } from '../../models/types';
import { AgentFormDialogComponent } from '../agent-form-dialog/agent-form-dialog.component';

@Component({
  selector: 'app-agent-management',
  templateUrl: './agent-management.component.html',
  styleUrls: ['./agent-management.component.scss']
})
export class AgentManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  agents: Agent[] = [];
  groups: Group[] = [];
  isLoading = false;
  displayedColumns: string[] = ['name', 'email', 'username', 'status', 'groups', 'actions'];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.isLoading = true;
    
    // Load agents and groups
    Promise.all([
      this.apiService.getAllAgents().toPromise(),
      this.apiService.getAllGroups().toPromise()
    ]).then(([agentsRes, groupsRes]) => {
      if (agentsRes?.success && agentsRes.data) {
        this.agents = agentsRes.data;
      }
      
      if (groupsRes?.success && groupsRes.data) {
        this.groups = groupsRes.data;
      }
      
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading data:', error);
      this.isLoading = false;
    });
  }

  createAgent(): void {
    const dialogRef = this.dialog.open(AgentFormDialogComponent, {
      width: '600px',
      data: {
        agent: null,
        groups: this.groups,
        mode: 'create'
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          const createRequest: CreateAgentRequest = result;
          this.apiService.createAgent(createRequest)
            .pipe(takeUntil(this.destroy$))
            .subscribe(response => {
              if (response.success) {
                this.loadData(); // Refresh the list
              }
            });
        }
      });
  }

  editAgent(agent: Agent): void {
    const dialogRef = this.dialog.open(AgentFormDialogComponent, {
      width: '600px',
      data: {
        agent: agent,
        groups: this.groups,
        mode: 'edit'
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          const updateRequest: UpdateAgentRequest = result;
          this.apiService.updateAgent(agent.id, updateRequest)
            .pipe(takeUntil(this.destroy$))
            .subscribe(response => {
              if (response.success) {
                this.loadData(); // Refresh the list
              }
            });
        }
      });
  }

  deleteAgent(agent: Agent): void {
    if (confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
      this.apiService.deleteAgent(agent.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(response => {
          if (response.success) {
            this.loadData(); // Refresh the list
          }
        });
    }
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

  getGroupName(groupId: string): string {
    const group = this.groups.find(g => g.id === groupId);
    return group ? group.name : 'Unknown Group';
  }

  refreshData(): void {
    this.loadData();
  }
}