<script setup lang="ts">
import {
    UiButton,
    UiField,
    UiFileInput,
    UiFileInputTrigger,
    UiFormDialog,
    UiInput,
    UiTagInput,
} from '@liry24/ui'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

import '@liry24/ui/styles.css'

const { id } = defineProps<{ id?: string }>()

const toast = useToast()
const router = useRouter()
const request = useRequestFetch()

const docId = ref(id ?? '')
const title = ref('')
const slug = ref<string>()
const manualSlug = ref(false)
const summary = ref('')
const tags = ref<Array<string>>([])
const cover = ref<MediaReference | undefined>(undefined)
const authoredAtLocal = ref('')
const order = ref(0)
const body = ref('')
const status = ref<ContentDocumentStatus | null>(null)
const schedules = ref<Array<ContentSchedule>>([])
const scheduleOpen = ref(false)
const scheduleAtLocal = ref('')
const scheduleError = ref('')
const publishMenuId = useId()
const focusPublishMenu = () => document.getElementById(publishMenuId)
const scheduleDateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
})
const { data: tagSuggestions } = useLazyFetch('/api/admin/posts/tags', { server: false })

type PostAction = 'draft' | 'publish' | 'schedule'
const pendingAction = ref<PostAction | 'unschedule' | null>(null)
const uploading = ref(false)
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

const toLocalDatetimeInput = (iso: string | undefined): string => {
    if (!iso) return ''

    const ms = Date.parse(iso)
    if (Number.isNaN(ms)) return ''

    const offset = new Date(ms).getTimezoneOffset() * 60 * 1000
    return new Date(ms - offset).toISOString().slice(0, 16)
}

const toIsoWithOffset = (local: string): string | undefined => {
    if (!local.trim()) return undefined

    const parsed = new Date(local)
    if (Number.isNaN(parsed.getTime())) return undefined

    return parsed.toISOString()
}

const loadDocument = async () => {
    if (!docId.value) return

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
    }>(`/api/admin/content/posts/${encodeURIComponent(docId.value)}`)

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
    tags.value = doc.data.tags ?? []
    cover.value = doc.data.cover
    authoredAtLocal.value = toLocalDatetimeInput(doc.data.authoredAt)
    order.value = doc.data.order ?? 0
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
            summary: summary.value.trim() || undefined,
            tags: tags.value,
            cover: cover.value,
            authoredAt: toIsoWithOffset(authoredAtLocal.value),
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
    return savedId
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
        const savedId = await saveDraft()
        if (!savedId) {
            if (action === 'schedule') {
                scheduleError.value =
                    'Check the highlighted fields in the editor before scheduling.'
            }
            return
        }

        if (action !== 'draft') {
            const target = { collection: 'posts' as const, id: savedId }
            await $fetch('/api/admin/content/publish', {
                method: 'POST',
                body: action === 'schedule' ? { ...target, action, at } : { ...target, action },
            })
        }
        if (action === 'schedule') scheduleOpen.value = false
        toast.add({ title: actionLabels[action].success, color: 'success' })
        if (!id) await router.replace(`/admin/posts/${encodeURIComponent(savedId)}`)
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
    scheduleAtLocal.value = toLocalDatetimeInput(new Date(Date.now() + 3_600_000).toISOString())
    scheduleOpen.value = true
}

const schedulePublish = async () => {
    if (schedules.value.length) return

    scheduleError.value = ''
    const at = toIsoWithOffset(scheduleAtLocal.value)
    if (!at || Date.parse(at) <= Date.now()) {
        scheduleError.value = 'Choose a future date and time.'
        return
    }
    await runPostAction('schedule', at)
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
                                    :id="publishMenuId"
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
            <p v-if="formError" class="ui-alert" role="alert">{{ formError }}</p>

            <div class="grid gap-4 sm:grid-cols-2">
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

                <UiField label="Summary" :error="errors['data.summary']">
                    <UiInput
                        v-model="summary"
                        placeholder="Short summary"
                        class="ui-input"
                        :disabled="!!pendingAction"
                    />
                </UiField>

                <UiField
                    label="Tags"
                    :error="errors['data.tags']"
                    description="Press Enter to add a tag."
                    class="sm:col-span-2"
                >
                    <UiTagInput
                        v-model="tags"
                        :suggestions="tagSuggestions?.tags ?? []"
                        :disabled="!!pendingAction"
                    />
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
                    <UiInput v-model="authoredAtLocal" type="datetime-local" class="ui-input" />
                </UiField>
                <AdminEntrySlug
                    v-model="slug"
                    v-model:manual="manualSlug"
                    :error="errors['data.slug']"
                />
            </fieldset>

            <UiFormDialog
                v-model:open="scheduleOpen"
                title="Scheduled publish"
                submit-label="Schedule"
                submitting-label="Scheduling…"
                :busy="busy"
                :saving="pendingAction === 'schedule'"
                :hide-submit="schedules.length > 0"
                :final-focus="focusPublishMenu"
                @submit="schedulePublish"
            >
                <div class="grid gap-4">
                    <p v-if="scheduleError" class="ui-alert" role="alert">{{ scheduleError }}</p>
                    <UiField
                        v-if="!schedules.length"
                        label="Schedule at"
                        description="Use your local time."
                        required
                    >
                        <UiInput
                            v-model="scheduleAtLocal"
                            type="datetime-local"
                            class="ui-input"
                            :disabled="busy"
                            required
                        />
                    </UiField>
                    <ul
                        v-if="schedules.length"
                        class="border-default divide-default divide-y border-t"
                    >
                        <li
                            v-for="entry in schedules"
                            :key="entry.id"
                            class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                        >
                            <span>
                                <time :datetime="entry.at">{{
                                    scheduleDateFormat.format(new Date(entry.at))
                                }}</time>
                                · {{ entry.status }}
                            </span>
                            <UiButton
                                type="button"
                                class="ui-button"
                                data-variant="ghost"
                                data-tone="danger"
                                :disabled="busy"
                                @click="unschedule(entry.id)"
                            >
                                Cancel schedule
                            </UiButton>
                        </li>
                    </ul>
                </div>
            </UiFormDialog>
        </template>
    </UDashboardPanel>
</template>
