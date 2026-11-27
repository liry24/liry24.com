<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

const { id } = defineProps<{ id?: string }>()

const toast = useToast()
const router = useRouter()
const request = useRequestFetch()

const docId = ref(id ?? '')
const title = ref('')
const slug = ref<string>()
const manualSlug = ref(false)
const tags = ref<Array<string>>([])
const cover = ref<MediaReference | undefined>(undefined)
const authoredAtLocal = ref('')
const order = ref(0)
const body = ref('')
const status = ref<ContentDocumentStatus | null>(null)
const schedules = ref<Array<ContentSchedule>>([])
const scheduleOpen = ref(false)
const scheduleError = ref('')
const publishMenu = useTemplateRef<{ $el?: HTMLElement }>('publishMenu')
const focusPublishMenu = () => publishMenu.value?.$el ?? null
const { data: tagSuggestions } = useLazyFetch('/api/admin/posts/tags', { server: false })

type PostAction = 'draft' | 'publish' | 'schedule'
const pendingAction = ref<PostAction | 'unschedule' | null>(null)
const { uploading, uploadSingle } = useAdminMediaUpload('posts')
const formError = ref('')
const errors = ref<Record<string, string>>({})
const showPreview = ref(false)
const games = reactive(new Map<string, GameSearchResult>())
const pendingGames = ref(0)
const busy = computed(() => !!pendingAction.value || uploading.value || pendingGames.value > 0)
const displayTitle = computed(() =>
    gameTitleParts(title.value)
        .map((part) => (part.slug ? (games.get(part.slug)?.name ?? part.slug) : part.text))
        .join(''),
)
provide(postPreviewGamesKey, games)

const rememberGame = (game: GameSearchResult) => {
    games.set(game.slug, game)
}

const loadDocument = async () => {
    if (!docId.value) return

    const doc = await request(`/api/admin/content/posts/${encodeURIComponent(docId.value)}`)
    if (!isPostData(doc.data)) throw new Error('Invalid post document')

    const post = doc.data
    const missing = [
        ...new Set(
            [
                ...postEditorMentionParts(post.title ?? '', false),
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
    title.value = post.title ?? ''
    slug.value = post.slug ?? doc.id
    tags.value = post.tags ?? []
    cover.value = post.cover
    authoredAtLocal.value = toLocalDatetimeInput(post.authoredAt)
    order.value = post.order ?? 0
    body.value = doc.body ?? ''
    status.value = doc.status
    schedules.value = doc.schedules
}

if (id) await loadDocument()

const coverFiles = shallowRef<Array<File>>([])
const uploadCover = async (files: Array<File>) => {
    coverFiles.value = files
    const file = files[0]
    if (!file) return

    try {
        const uploaded = await uploadSingle(file, {
            successTitle: 'Uploaded cover image',
            fallbackError: 'Could not upload cover image.',
        })
        if (uploaded) cover.value = uploaded
    } finally {
        coverFiles.value = []
    }
}

const saveDraft = async () => {
    formError.value = ''
    errors.value = {}
    const manualValue = manualSlug.value ? slug.value?.trim() : undefined
    if (manualSlug.value && !manualValue) {
        formError.value = 'Check the highlighted fields.'
        errors.value = { 'data.slug': 'Enter a slug.' }
        return
    }

    const [submitError, result] = await submitForm('post', {
        id: docId.value || undefined,
        data: {
            title: postEditorMentionParts(title.value, false)
                .map((part) => (part.slug ? formatGameMention(part.slug) : part.text))
                .join(''),
            slug: manualValue,
            tags: tags.value,
            cover: cover.value,
            authoredAt: toIsoFromLocalInput(authoredAtLocal.value),
            order: Number(order.value) || 0,
        },
        body: postEditorMentionParts(body.value, true)
            .map((part) => (part.slug ? formatGameMention(part.slug) : part.text))
            .join(''),
    })
    if (submitError) {
        formError.value = submitError.message
        errors.value = fieldErrors(submitError)
        return
    }
    const savedId = result?.id || docId.value
    if (!savedId) throw new Error('The saved draft could not be identified.')

    docId.value = savedId
    const digest = result && 'digest' in result ? result.digest : undefined
    return { id: savedId, digest: typeof digest === 'string' ? digest : undefined }
}

const actionLabels = {
    draft: { success: 'Saved draft', failure: 'Could not save draft.' },
    publish: { success: 'Published post', failure: 'Could not publish post.' },
    schedule: { success: 'Scheduled publish', failure: 'Could not schedule post.' },
}

const runPostAction = async (
    ...args: [action: 'draft' | 'publish'] | [action: 'schedule', at: string]
) => {
    const [action, at] = args
    if (busy.value) return

    pendingAction.value = action
    try {
        const saved = await saveDraft()
        if (!saved) {
            if (action === 'schedule') {
                scheduleError.value =
                    'Check the highlighted fields in the editor before scheduling.'
            }
            return
        }

        if (action !== 'draft') {
            const target = { collection: 'posts' as const, ...saved }
            await $fetch('/api/admin/content/publish', {
                method: 'POST',
                body: action === 'schedule' ? { ...target, action, at } : { ...target, action },
            })
        }
        if (action === 'schedule') scheduleOpen.value = false
        toast.add({ title: actionLabels[action].success, color: 'success' })
        if (!id) await router.replace(`/admin/posts/${encodeURIComponent(saved.id)}`)
        else await loadDocument()
    } catch (error) {
        const message = adminErrorMessage(error, actionLabels[action].failure)
        if (action === 'schedule') scheduleError.value = message
        else formError.value = message
    } finally {
        pendingAction.value = null
    }
}

const openSchedule = () => {
    scheduleError.value = ''
    scheduleOpen.value = true
}

const unschedule = async (scheduleId: string) => {
    if (busy.value) return
    scheduleError.value = ''
    pendingAction.value = 'unschedule'
    try {
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'unschedule',
                scheduleId,
            },
        })
        toast.add({ title: 'Cancelled schedule', color: 'neutral' })
        schedules.value = schedules.value.filter((entry) => entry.id !== scheduleId)
    } catch (error) {
        scheduleError.value = adminErrorMessage(error, 'Could not cancel schedule.')
    } finally {
        pendingAction.value = null
    }
}

const publishActions: Array<DropdownMenuItem> = [
    { label: 'Save draft', icon: 'lucide:save', onSelect: () => void runPostAction('draft') },
    { label: 'Scheduled publish', icon: 'lucide:calendar-clock', onSelect: openSchedule },
]
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
                :title="id ? `Edit post: ${displayTitle || docId}` : 'New post'"
                icon="mingcute:document-2-fill"
            >
                <template #right>
                    <div class="flex flex-wrap items-center justify-end gap-2">
                        <UBadge
                            v-if="status?.state"
                            :label="status.state"
                            :color="status.state === 'published' ? 'success' : 'warning'"
                            variant="subtle"
                            size="sm"
                        />
                        <UButton
                            :label="showPreview ? 'Edit Markdown' : 'Preview Markdown'"
                            variant="ghost"
                            color="neutral"
                            :disabled="busy"
                            @click="showPreview = !showPreview"
                        />
                        <UFieldGroup role="group" aria-label="Publish">
                            <UButton
                                label="Publish"
                                color="neutral"
                                :loading="pendingAction === 'publish'"
                                :disabled="busy"
                                @click="runPostAction('publish')"
                            />
                            <UDropdownMenu
                                :items="publishActions"
                                :content="{ align: 'end' }"
                                :modal="false"
                                :disabled="busy"
                            >
                                <UButton
                                    ref="publishMenu"
                                    aria-label="Publish options"
                                    icon="lucide:chevron-down"
                                    color="neutral"
                                    variant="outline"
                                    :loading="pendingAction === 'draft'"
                                    :disabled="busy"
                                />
                            </UDropdownMenu>
                        </UFieldGroup>
                    </div>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UiAlert v-if="formError">{{ formError }}</UiAlert>

            <div class="grid gap-4">
                <UiField label="Title" :error="errors['data.title']" required>
                    <AdminPostSlashEditor
                        v-model="title"
                        :games="games"
                        placeholder="Post title"
                        :disabled="!!pendingAction"
                        required
                        @game="rememberGame"
                        @pending="pendingGames += $event"
                    />
                </UiField>

                <UiField
                    label="Tags"
                    :error="errors['data.tags']"
                    description="Press Enter to add a tag."
                >
                    <UiTagInput
                        v-model="tags"
                        :suggestions="tagSuggestions?.tags ?? []"
                        :disabled="!!pendingAction"
                    />
                </UiField>
            </div>

            <UiCard class="flex flex-wrap items-center gap-4 p-4">
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
                        <UiFileInputTrigger>
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
                    variant="ghost"
                    color="error"
                    :disabled="busy"
                    @click="cover = undefined"
                    >Clear</UiButton
                >
            </UiCard>

            <UiField
                label="Body (Markdown)"
                :error="errors.body"
                description="Start with an introductory paragraph for the post excerpt. Type / to insert Markdown or mention a game."
            >
                <UiCard v-if="showPreview" class="prose dark:prose-invert min-h-80 max-w-none p-4">
                    <Markdown :value="body" :plugins="[postMarkdownSecurity]" />
                </UiCard>
                <AdminPostSlashEditor
                    v-show="!showPreview"
                    v-model="body"
                    :games="games"
                    placeholder="Write Markdown…"
                    :disabled="!!pendingAction"
                    multiline
                    @game="rememberGame"
                    @pending="pendingGames += $event"
                />
            </UiField>

            <fieldset :disabled="!!pendingAction" class="grid min-w-0 gap-4">
                <UiField
                    label="Authored at"
                    :error="errors['data.authoredAt']"
                    description="Defaults to the time this post is published."
                    class="sm:max-w-sm"
                >
                    <UiInput v-model="authoredAtLocal" type="datetime-local" />
                </UiField>
                <AdminEntrySlug
                    v-model="slug"
                    v-model:manual="manualSlug"
                    :error="errors['data.slug']"
                />
            </fieldset>

            <AdminPostScheduleDialog
                v-model:open="scheduleOpen"
                :schedules="schedules"
                :busy="busy"
                :saving="pendingAction === 'schedule'"
                :error="scheduleError"
                :final-focus="focusPublishMenu"
                @schedule="runPostAction('schedule', $event)"
                @unschedule="unschedule"
            />
        </template>
    </UDashboardPanel>
</template>
