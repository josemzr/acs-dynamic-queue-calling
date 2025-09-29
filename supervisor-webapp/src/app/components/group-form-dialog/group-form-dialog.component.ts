import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Group, CreateGroupRequest, UpdateGroupRequest } from '../../models/types';

export interface GroupFormDialogData {
  group: Group | null;
  allGroups: Group[];
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-group-form-dialog',
  templateUrl: './group-form-dialog.component.html',
  styleUrls: ['./group-form-dialog.component.scss']
})
export class GroupFormDialogComponent implements OnInit {
  groupForm: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<GroupFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GroupFormDialogData
  ) {
    this.isEditMode = data.mode === 'edit';
    this.groupForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.group) {
      this.populateForm(this.data.group);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      location: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      overflowEnabled: [false],
      overflowGroupIds: [[]]
    });
  }

  private populateForm(group: Group): void {
    this.groupForm.patchValue({
      name: group.name,
      location: group.location,
      phoneNumber: group.phoneNumber,
      overflowEnabled: group.overflowEnabled,
      overflowGroupIds: group.overflowGroupIds
    });
  }

  onSubmit(): void {
    if (this.groupForm.valid) {
      const formValue = this.groupForm.value;
      
      if (this.isEditMode) {
        const updateRequest: UpdateGroupRequest = {
          name: formValue.name,
          location: formValue.location,
          phoneNumber: formValue.phoneNumber,
          overflowEnabled: formValue.overflowEnabled,
          overflowGroupIds: formValue.overflowGroupIds
        };
        
        this.dialogRef.close(updateRequest);
      } else {
        const createRequest: CreateGroupRequest = {
          name: formValue.name,
          location: formValue.location,
          phoneNumber: formValue.phoneNumber,
          overflowEnabled: formValue.overflowEnabled,
          overflowGroupIds: formValue.overflowGroupIds
        };
        
        this.dialogRef.close(createRequest);
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getFormTitle(): string {
    return this.isEditMode ? 'Edit Group' : 'Create New Group';
  }

  getSubmitButtonText(): string {
    return this.isEditMode ? 'Update' : 'Create';
  }

  // Helper methods for form validation
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.groupForm.get(fieldName);
    return field ? field.hasError(errorType) && (field.dirty || field.touched) : false;
  }

  getErrorMessage(fieldName: string): string {
    const field = this.groupForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('required')) {
      return `${this.getFieldDisplayName(fieldName)} is required`;
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `${this.getFieldDisplayName(fieldName)} must be at least ${minLength} characters`;
    }
    if (field.hasError('pattern')) {
      return 'Please enter a valid phone number';
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    switch (fieldName) {
      case 'phoneNumber': return 'Phone number';
      default: return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    }
  }
}