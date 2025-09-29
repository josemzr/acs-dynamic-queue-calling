import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Agent, Group, CreateAgentRequest, UpdateAgentRequest } from '../../models/types';

export interface AgentFormDialogData {
  agent: Agent | null;
  groups: Group[];
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-agent-form-dialog',
  templateUrl: './agent-form-dialog.component.html',
  styleUrls: ['./agent-form-dialog.component.scss']
})
export class AgentFormDialogComponent implements OnInit {
  agentForm: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AgentFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AgentFormDialogData
  ) {
    this.isEditMode = data.mode === 'edit';
    this.agentForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.agent) {
      this.populateForm(this.data.agent);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', this.isEditMode ? [] : [Validators.required, Validators.minLength(6)]],
      groupIds: [[], []]
    });
  }

  private populateForm(agent: Agent): void {
    this.agentForm.patchValue({
      name: agent.name,
      email: agent.email,
      username: agent.username,
      password: '', // Don't pre-fill password for security
      groupIds: agent.groupIds
    });
  }

  onSubmit(): void {
    if (this.agentForm.valid) {
      const formValue = this.agentForm.value;
      
      if (this.isEditMode) {
        // For edit mode, only include changed fields
        const updateRequest: UpdateAgentRequest = {
          name: formValue.name,
          email: formValue.email,
          username: formValue.username,
          groupIds: formValue.groupIds
        };
        
        // Only include password if it was changed
        if (formValue.password && formValue.password.trim() !== '') {
          updateRequest.password = formValue.password;
        }
        
        this.dialogRef.close(updateRequest);
      } else {
        // For create mode, include all required fields
        const createRequest: CreateAgentRequest = {
          name: formValue.name,
          email: formValue.email,
          username: formValue.username,
          password: formValue.password,
          groupIds: formValue.groupIds
        };
        
        this.dialogRef.close(createRequest);
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getFormTitle(): string {
    return this.isEditMode ? 'Edit Agent' : 'Create New Agent';
  }

  getSubmitButtonText(): string {
    return this.isEditMode ? 'Update' : 'Create';
  }

  getPasswordLabel(): string {
    return this.isEditMode ? 'New Password (leave blank to keep current)' : 'Password';
  }

  // Helper methods for form validation
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.agentForm.get(fieldName);
    return field ? field.hasError(errorType) && (field.dirty || field.touched) : false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.agentForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    if (field.hasError('email')) {
      return 'Please enter a valid email address';
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${minLength} characters`;
    }
    return '';
  }
}