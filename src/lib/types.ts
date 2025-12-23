export interface User {
  id: string
  email: string
  name: string
  orgId: string
  'cognito:groups'?: string[]
  role?: 'Admin' | 'Moderators' | 'Users'
  avatarUrl?: string
  bio?: string
  theme?: 'light' | 'dark' | 'system'
}

export interface UserProfile {
  userId: string
  email: string
  name: string
  bio?: string
  avatar?: string
  joinedAt: string
  stats: {
    tasksCreated: number
    tasksCompleted: number
    announcementsCreated: number
  }
}

export interface Annotation {
  id: string
  itemSk: string
  adminId: string
  adminName: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface SubTask {
  id: string
  title: string
  completed: boolean
  completedAt?: string
  completedBy?: string
}

export interface Task {
  id: string
  pk: string
  sk: string
  type: 'task'
  title: string
  content: string
  createdAt: string
  updatedAt?: string
  userId: string
  userName: string
  status: 'active' | 'completed' | 'in-progress'
  deadline?: string // ISO date string
  subtasks: SubTask[]
  completedAt?: string
  archivedAt?: string // ISO date string - task archived date
  archiveStatus?: 'aborted' | 'partial' | 'completed' | 'forced' // completion state when archived
  hasBeenInProgress?: boolean // tracks if task ever had subtasks (prevents deletion)
  attachments?: FileAttachment[]
  annotations?: Annotation[]
}

export interface Announcement {
  id: string
  pk: string
  sk: string
  type: 'announcement'
  title: string
  content: string
  createdAt: string
  updatedAt?: string
  userId: string
  userName: string
  priority?: 'normal' | 'high' | 'urgent'
  expiresAt?: string // ISO date string
  isPinned?: boolean
  pinnedUntil?: string // ISO date string - auto unpin after this date
  attachments?: FileAttachment[]
  annotations?: Annotation[]
}

export type SparkItem = Task | Announcement

export interface FileAttachment {
  name: string
  size: number
  type: string
  dataUrl?: string // Base64 data URL for preview (temporary, not stored)
  url?: string // S3 URL for downloading
  key?: string // S3 object key
  file?: File // Original File object (temporary, for upload)
}

export interface CreateTaskInput {
  type: 'task'
  title: string
  content: string
  deadline?: string
  subtasks?: SubTask[]
  attachments?: FileAttachment[]
}

export interface CreateAnnouncementInput {
  type: 'announcement'
  title: string
  content: string
  priority?: 'normal' | 'high' | 'urgent'
  expiresAt?: string
  isPinned?: boolean
  pinnedUntil?: string
  attachments?: FileAttachment[]
}

export type CreateItemInput = CreateTaskInput | CreateAnnouncementInput
