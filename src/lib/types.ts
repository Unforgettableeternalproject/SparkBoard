export interface User {
  id: string
  email: string
  name: string
  orgId: string
}

export interface SparkItem {
  id: string
  pk: string
  sk: string
  type: 'task' | 'announcement'
  title: string
  content: string
  createdAt: string
  userId: string
  userName: string
  attachments?: FileAttachment[]
}

export interface FileAttachment {
  name: string
  size: number
  type: string
  dataUrl?: string
}

export interface CreateItemInput {
  type: 'task' | 'announcement'
  title: string
  content: string
  attachments?: FileAttachment[]
}
