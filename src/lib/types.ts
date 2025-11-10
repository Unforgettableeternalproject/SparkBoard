export interface User {
  id: string
  email: string
  name: string
  orgId: string
  'cognito:groups'?: string[]
  role?: 'Admin' | 'Moderators' | 'Users'
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
  status: 'active' | 'completed'
  deadline?: string // ISO date string
  subtasks: SubTask[]
  completedAt?: string
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
  dataUrl?: string
  url?: string // S3 presigned URL for downloading
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
