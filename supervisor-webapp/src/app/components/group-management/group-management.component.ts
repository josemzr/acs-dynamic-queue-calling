import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Group, CreateGroupRequest, UpdateGroupRequest } from '../../models/types';
import { GroupFormDialogComponent } from '../group-form-dialog/group-form-dialog.component';

@Component({
  selector: 'app-group-management',
  templateUrl: './group-management.component.html',
  styleUrls: ['./group-management.component.scss']
})
export class GroupManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  groups: Group[] = [];
  isLoading = false;
  displayedColumns: string[] = ['name', 'location', 'phoneNumber', 'agentCount', 'overflow', 'actions'];

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
    
    this.apiService.getAllGroups()
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        if (response.success && response.data) {
          this.groups = response.data;
        }
        this.isLoading = false;
      }, error => {
        console.error('Error loading groups:', error);
        this.isLoading = false;
      });
  }

  createGroup(): void {
    const dialogRef = this.dialog.open(GroupFormDialogComponent, {
      width: '600px',
      data: {
        group: null,
        allGroups: this.groups,
        mode: 'create'
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          const createRequest: CreateGroupRequest = result;
          this.apiService.createGroup(createRequest)
            .pipe(takeUntil(this.destroy$))
            .subscribe(response => {
              if (response.success) {
                this.loadData(); // Refresh the list
              }
            });
        }
      });
  }

  editGroup(group: Group): void {
    const dialogRef = this.dialog.open(GroupFormDialogComponent, {
      width: '600px',
      data: {
        group: group,
        allGroups: this.groups.filter(g => g.id !== group.id), // Exclude current group from overflow options
        mode: 'edit'
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          const updateRequest: UpdateGroupRequest = result;
          this.apiService.updateGroup(group.id, updateRequest)
            .pipe(takeUntil(this.destroy$))
            .subscribe(response => {
              if (response.success) {
                this.loadData(); // Refresh the list
              }
            });
        }
      });
  }

  deleteGroup(group: Group): void {
    if (confirm(`Are you sure you want to delete group "${group.name}"? This will remove all agents from this group.`)) {
      this.apiService.deleteGroup(group.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(response => {
          if (response.success) {
            this.loadData(); // Refresh the list
          }
        });
    }
  }

  refreshData(): void {
    this.loadData();
  }
}