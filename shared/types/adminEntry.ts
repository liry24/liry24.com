export interface AdminEntry {
    id: string
    model: string
    locale?: string
    data: Record<string, unknown>
    digest?: string
    revision?: string
    version?: number
    updatedAt: string | null
    order: number
    scheduledAt?: string
    status: 'draft' | 'published' | 'changed' | 'immediate'
}
