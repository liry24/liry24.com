<script setup lang="ts">
import { UiButton, UiField, UiFileInput, UiFileInputTrigger, UiInput } from '@liry24/ui'
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

import '@liry24/ui/styles.css'

const props = defineProps<{
    id?: string
}>()

const toast = useToast()
const router = useRouter()
const request = useRequestFetch()

const docId = ref(props.id ?? '')
const title = ref('')
const slug = ref('')
const slugTouched = ref(Boolean(props.id))
const summary = ref('')
const tagsText = ref('')
const cover = ref<MediaReference | undefined>(undefined)
const authoredAtLocal = ref('')
const order = ref(0)
const body = ref('')
const status = ref<ContentDocumentStatus | null>(null)
const schedules = ref<Array<ContentSchedule>>([])
const scheduleAtLocal = ref('')

const saving = ref(false)
const publishing = ref(false)
const uploading = ref(false)
const formError = ref('')
const errors = ref<Record<string, string>>({})
const showPreview = ref(false)
const games = reactive(new Map<string, GameSearchResult>())
const pendingGames = ref(0)
const busy = computed(
    () => saving.value || publishing.value || uploading.value || pendingGames.value > 0,
)
const displayTitle = computed(() =>
    gameTitleParts(title.value)
        .map((part) => (part.slug ? (games.get(part.slug)?.name ?? part.slug) : part.text))
        .join(''),
)
provide(postPreviewGamesKey, games)

function rememberGame(game: GameSearchResult) {
    games.set(game.slug, game)
}

function toLocalDatetimeInput(iso: string | undefined): string {
    if (!iso) {
        return ''
    }
    const ms = Date.parse(iso)
    if (Number.isNaN(ms)) {
        return ''
    }
    const offset = new Date(ms).getTimezoneOffset() * 60 * 1000
    return new Date(ms - offset).toISOString().slice(0, 16)
}

function toIsoWithOffset(local: string): string | undefined {
    if (!local.trim()) {
        return undefined
    }
    const parsed = new Date(local)
    if (Number.isNaN(parsed.getTime())) {
        return undefined
    }
    return parsed.toISOString()
}

const loadDocument = async () => {
    if (!props.id) {
        return
    }
    const doc = await request<{
        id: string
        data: {
            title?: string
            slug?: string
            summary?: string
            tags?: Array<string>
            cover?: MediaReference
            authoredAt?: string
            order?: number
        }
        body: string
        status: ContentDocumentStatus | null
        schedules: Array<ContentSchedule>
    }>(`/api/admin/content/posts/${encodeURIComponent(props.id)}`)

    const missing = [
        ...new Set(
            [
                ...postEditorMentionParts(doc.data.title ?? '', false),
                ...postEditorMentionParts(doc.body ?? '', true),
            ].flatMap(({ slug: gameSlug }) => (gameSlug && !games.has(gameSlug) ? [gameSlug] : [])),
        ),
    ]
    if (missing.length) {
        try {
            for (let index = 0; index < missing.length; index += 40) {
                const result = await request('/api/admin/games', {
                    query: { slug: missing.slice(index, index + 40) },
                })
                result.games.forEach(rememberGame)
            }
        } catch {
            toast.add({ title: 'Could not load game names', color: 'warning' })
        }
    }
    docId.value = doc.id
    title.value = doc.data.title ?? ''
    slug.value = doc.data.slug ?? doc.id
    summary.value = doc.data.summary ?? ''
    tagsText.value = (doc.data.tags ?? []).join(', ')
    cover.value = doc.data.cover
    authoredAtLocal.value = toLocalDatetimeInput(doc.data.authoredAt)
    order.value = doc.data.order ?? 0
    body.value = doc.body ?? ''
    status.value = doc.status
    schedules.value = doc.schedules
}

if (props.id) {
    await loadDocument()
}

watch(displayTitle, (value) => {
    if (!slugTouched.value && !props.id) {
        slug.value = entrySlugSuggestion(value)
    }
})

const coverFiles = shallowRef<Array<File>>([])
const uploadCover = async (files: Array<File>) => {
    coverFiles.value = files
    const file = files[0]
    if (!file) {
        return
    }
    uploading.value = true
    try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'posts')
        cover.value = await $fetch<MediaReference>('/api/admin/media', {
            method: 'POST',
            body: formData,
        })
        toast.add({ title: 'Uploaded cover image', color: 'success' })
    } catch (error) {
        toast.add({
            title: 'Upload failed',
            description: adminErrorMessage(error, 'Could not upload cover image.'),
            color: 'error',
        })
    } finally {
        uploading.value = false
        coverFiles.value = []
    }
}

const saveDraft = async (): Promise<string | undefined> => {
    if (saving.value || uploading.value || pendingGames.value > 0) {
        return
    }
    saving.value = true
    formError.value = ''
    errors.value = {}
    try {
        const tags = tagsText.value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)

        interface PostDraftData {
            title: string
            plainTitle: string
            slug: string
            tags: Array<string>
            gameMentions: Array<string>
            order: number
            summary?: string
            cover?: MediaReference
            authoredAt?: string
        }

        type PostFormPayload = {
            id?: string
            data: PostDraftData
            body: string
        }

        const postData: PostDraftData = {
            title: postEditorMentionParts(title.value, false)
                .map((part) => (part.slug ? formatGameMention(part.slug) : part.text))
                .join(''),
            plainTitle: displayTitle.value,
            slug: slug.value,
            tags,
            gameMentions: [],
            order: Number(order.value) || 0,
        }
        const trimmedSummary = summary.value.trim()
        if (trimmedSummary) {
            postData.summary = trimmedSummary
        }
        if (cover.value) {
            postData.cover = cover.value
        }
        if (authoredAtLocal.value) {
            const authoredAt = toIsoWithOffset(authoredAtLocal.value)
            if (authoredAt) {
                postData.authoredAt = authoredAt
            }
        }
        const payload: PostFormPayload = {
            data: postData,
            body: postEditorMentionParts(body.value, true)
                .map((part) => (part.slug ? formatGameMention(part.slug) : part.text))
                .join(''),
        }
        if (docId.value) {
            payload.id = docId.value
        }

        const [submitError, result] = await submitForm('post', payload)
        if (submitError) {
            formError.value = submitError.message
            errors.value = fieldErrors(submitError)
            return undefined
        }

        const savedId = result?.id || docId.value || slug.value
        docId.value = savedId
        toast.add({ title: 'Saved draft', color: 'success' })
        if (!props.id && savedId) {
            await router.replace(`/admin/posts/${encodeURIComponent(savedId)}`)
        } else {
            await loadDocument()
        }
        return savedId
    } finally {
        saving.value = false
    }
}

const publishNow = async () => {
    publishing.value = true
    try {
        const savedId = await saveDraft()
        if (!savedId) {
            return
        }
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'publish',
                collection: 'posts',
                id: savedId,
            },
        })
        toast.add({ title: 'Published post', color: 'success' })
        await loadDocument()
    } catch (error) {
        toast.add({
            title: 'Publish failed',
            description: adminErrorMessage(error, 'Could not publish post.'),
            color: 'error',
        })
    } finally {
        publishing.value = false
    }
}

const schedulePublish = async () => {
    if (!scheduleAtLocal.value) {
        return
    }
    publishing.value = true
    try {
        const savedId = await saveDraft()
        if (!savedId) {
            return
        }
        const at = toIsoWithOffset(scheduleAtLocal.value)
        if (!at) {
            throw new Error('Choose a valid future date and time.')
        }
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'schedule',
                collection: 'posts',
                id: savedId,
                at,
            },
        })
        toast.add({ title: 'Scheduled publish', color: 'success' })
        scheduleAtLocal.value = ''
        await loadDocument()
    } catch (error) {
        toast.add({
            title: 'Schedule failed',
            description: adminErrorMessage(error, 'Could not schedule publish.'),
            color: 'error',
        })
    } finally {
        publishing.value = false
    }
}

const unschedule = async (scheduleId: string) => {
    publishing.value = true
    try {
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'unschedule',
                scheduleId,
            },
        })
        toast.add({ title: 'Cancelled schedule', color: 'neutral' })
        await loadDocument()
    } catch (error) {
        toast.add({
            title: 'Unschedule failed',
            description: adminErrorMessage(error, 'Could not cancel schedule.'),
            color: 'error',
        })
    } finally {
        publishing.value = false
    }
}
</script>

<template>
    <UDashboardPanel
        id="post-editor"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-6 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar
                :title="props.id ? `Edit post: ${displayTitle || docId}` : 'New post'"
                icon="mingcute:document-2-fill"
            >
                <template #right>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                        <span
                            v-if="status?.state"
                            class="ui-badge"
                            :data-tone="status.state === 'published' ? 'success' : 'warning'"
                        >
                            {{ status.state }}
                        </span>
                        <UiButton
                            class="ui-button"
                            data-variant="ghost"
                            :disabled="busy"
                            @click="showPreview = !showPreview"
                        >
                            {{ showPreview ? 'Edit Markdown' : 'Preview Markdown' }}
                        </UiButton>
                        <UiButton class="ui-button" :disabled="busy" @click="saveDraft">
                            {{ saving ? 'Saving…' : 'Save draft' }}
                        </UiButton>
                        <UiButton
                            class="ui-button"
                            data-variant="primary"
                            :disabled="busy"
                            @click="publishNow"
                        >
                            {{ publishing ? 'Publishing…' : 'Publish' }}
                        </UiButton>
                    </div>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <p v-if="formError" class="ui-alert" role="alert">{{ formError }}</p>

            <div class="grid gap-4 sm:grid-cols-2">
                <UiField label="Title" :error="errors['data.title']" required>
                    <AdminPostSlashEditor
                        v-model="title"
                        :games="games"
                        placeholder="Post title"
                        :disabled="saving || publishing"
                        required
                        @game="rememberGame"
                        @pending="pendingGames += $event"
                    />
                </UiField>

                <UiField label="Slug" :error="errors['data.slug']" required>
                    <UiInput
                        v-model="slug"
                        placeholder="my-post-slug"
                        class="ui-input font-mono"
                        @update:model-value="slugTouched = true"
                    />
                </UiField>

                <UiField label="Summary" :error="errors['data.summary']" class="sm:col-span-2">
                    <UiInput v-model="summary" placeholder="Short summary" class="ui-input" />
                </UiField>

                <UiField label="Tags (comma separated)" :error="errors['data.tags']">
                    <UiInput v-model="tagsText" placeholder="gaming, dev, notes" class="ui-input" />
                </UiField>

                <UiField label="Authored at" :error="errors['data.authoredAt']">
                    <UiInput v-model="authoredAtLocal" type="datetime-local" class="ui-input" />
                </UiField>
            </div>

            <div class="ui-card flex flex-wrap items-center gap-4 p-4">
                <UiField label="Cover image" :description="cover?.pathname">
                    <UiFileInput
                        :value="coverFiles"
                        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                        :disabled="busy"
                        @value-change="uploadCover"
                        @reject="
                            toast.add({ title: 'Choose a supported image file', color: 'error' })
                        "
                    >
                        <UiFileInputTrigger class="ui-button">
                            {{ uploading ? 'Uploading…' : 'Choose image' }}
                        </UiFileInputTrigger>
                    </UiFileInput>
                </UiField>
                <img
                    v-if="cover"
                    :src="mediaUrl(cover)"
                    alt="Cover preview"
                    class="h-14 w-24 rounded object-cover"
                />
                <UiButton
                    v-if="cover"
                    class="ui-button"
                    data-variant="ghost"
                    data-tone="danger"
                    :disabled="busy"
                    @click="cover = undefined"
                    >Clear</UiButton
                >
            </div>

            <UiField
                label="Body (Markdown)"
                :error="errors.body"
                description="Type / to insert Markdown or mention a game."
            >
                <div
                    v-if="showPreview"
                    class="ui-card prose dark:prose-invert min-h-80 max-w-none p-4"
                >
                    <Markdown :value="body" :plugins="[postMarkdownSecurity]" />
                </div>
                <AdminPostSlashEditor
                    v-show="!showPreview"
                    v-model="body"
                    :games="games"
                    placeholder="Write Markdown…"
                    :disabled="saving || publishing"
                    multiline
                    @game="rememberGame"
                    @pending="pendingGames += $event"
                />
            </UiField>

            <section class="ui-card p-4" aria-label="Scheduled publish">
                <div class="flex flex-col gap-3">
                    <h3 class="text-sm font-medium">Scheduled Publish</h3>
                    <div
                        v-for="entry in schedules"
                        :key="entry.id"
                        class="flex items-center justify-between gap-2 text-sm"
                    >
                        <span>{{ entry.at }} ({{ entry.status }})</span>
                        <UiButton
                            class="ui-button"
                            data-variant="ghost"
                            data-tone="danger"
                            :disabled="busy"
                            @click="unschedule(entry.id)"
                            >Cancel schedule</UiButton
                        >
                    </div>
                    <div class="flex flex-wrap items-end gap-2">
                        <UiField label="Schedule at">
                            <UiInput
                                v-model="scheduleAtLocal"
                                type="datetime-local"
                                class="ui-input"
                            />
                        </UiField>
                        <UiButton
                            class="ui-button"
                            :disabled="!scheduleAtLocal || busy"
                            @click="schedulePublish"
                            >Schedule</UiButton
                        >
                    </div>
                </div>
            </section>
        </template>
    </UDashboardPanel>
</template>
