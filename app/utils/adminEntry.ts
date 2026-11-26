export type AdminEntryData = Partial<
    WorkData & ArtData & CareerData & SkillData & GameStatsRecordData & SocialData
>

export interface AdminEntryRecord<T = AdminEntryData> {
    id: string
    data: T
}

export const isPostData = (data: CollectionDocumentData): data is PostData => 'gameMentions' in data
