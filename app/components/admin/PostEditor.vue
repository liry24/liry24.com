<script setup lang="ts">
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

import type { MediaReference } from '../../../shared/schemas/content'

const props = defineProps<{
    id?: string
}>()

const toast = useToast()
const router = useRouter()

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
    const doc = await $fetch<{
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

watch(title, (value) => {
    if (!slugTouched.value && !props.id) {
        slug.value = entrySlugSuggestion(value)
    }
})

const uploadCover = async (event: Event) => {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0]
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
        if (input) {
            input.value = ''
        }
    }
}

const saveDraft = async (): Promise<string | undefined> => {
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
            title: title.value,
            plainTitle: title.value,
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
            body: body.value,
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
                :title="props.id ? `Edit post: ${title || docId}` : 'New post'"
                icon="mingcute:document-2-fill"
            >
                <template #right>
                    <UBadge
                        v-if="status?.state"
                        :label="status.state"
                        :color="status.state === 'published' ? 'success' : 'warning'"
                        variant="subtle"
                    />
                    <UButton
                        :label="showPreview ? 'Edit Markdown' : 'Preview Markdown'"
                        variant="ghost"
                        color="neutral"
                        size="sm"
                        @click="showPreview = !showPreview"
                    />
                    <UButton
                        label="Save draft"
                        variant="outline"
                        color="neutral"
                        :loading="saving"
                        @click="saveDraft"
                    />
                    <UButton label="Publish" :loading="publishing || saving" @click="publishNow" />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UAlert v-if="formError" :title="formError" color="error" variant="subtle" />

            <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Title" :error="errors['data.title']" required>
                    <UInput
                        v-model="title"
                        placeholder="Post title or <game:slug>"
                        class="w-full"
                    />
                </UFormField>

                <UFormField label="Slug" :error="errors['data.slug']" required>
                    <UInput
                        v-model="slug"
                        placeholder="my-post-slug"
                        class="w-full font-mono"
                        @update:model-value="slugTouched = true"
                    />
                </UFormField>

                <UFormField label="Summary" :error="errors['data.summary']" class="sm:col-span-2">
                    <UInput v-model="summary" placeholder="Short summary" class="w-full" />
                </UFormField>

                <UFormField label="Tags (comma separated)" :error="errors['data.tags']">
                    <UInput v-model="tagsText" placeholder="gaming, dev, notes" class="w-full" />
                </UFormField>

                <UFormField label="Authored at" :error="errors['data.authoredAt']">
                    <UInput v-model="authoredAtLocal" type="datetime-local" class="w-full" />
                </UFormField>
            </div>

            <div class="border-default flex flex-wrap items-center gap-4 rounded-lg border p-4">
                <div class="flex flex-col gap-1">
                    <span class="text-sm font-medium">Cover image</span>
                    <span class="text-muted text-xs">{{ cover?.pathname || 'None uploaded' }}</span>
                </div>
                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                    class="text-sm"
                    :disabled="uploading"
                    @change="uploadCover"
                />
                <img
                    v-if="cover"
                    :src="mediaUrl(cover)"
                    alt="Cover preview"
                    class="h-14 w-24 rounded object-cover"
                />
                <UButton
                    v-if="cover"
                    label="Clear"
                    size="xs"
                    variant="ghost"
                    color="error"
                    @click="cover = undefined"
                />
            </div>

            <UFormField label="Body (Markdown)" :error="errors.body">
                <div
                    v-if="showPreview"
                    class="border-default prose dark:prose-invert min-h-80 max-w-none rounded-lg border p-4"
                >
                    <Markdown :value="body" :plugins="[postMarkdownSecurity]" />
                </div>
                <UTextarea
                    v-else
                    v-model="body"
                    :rows="18"
                    placeholder="Write Markdown here... Game mentions use <game:slug>."
                    class="w-full font-mono"
                />
            </UFormField>

            <UCard>
                <div class="flex flex-col gap-3">
                    <h3 class="text-sm font-medium">Scheduled Publish</h3>
                    <div
                        v-for="entry in schedules"
                        :key="entry.id"
                        class="flex items-center justify-between gap-2 text-sm"
                    >
                        <span>{{ entry.at }} ({{ entry.status }})</span>
                        <UButton
                            label="Cancel schedule"
                            size="xs"
                            color="warning"
                            variant="soft"
                            :loading="publishing"
                            @click="unschedule(entry.id)"
                        />
                    </div>
                    <div class="flex flex-wrap items-end gap-2">
                        <UFormField label="Schedule at">
                            <UInput v-model="scheduleAtLocal" type="datetime-local" />
                        </UFormField>
                        <UButton
                            label="Schedule"
                            variant="outline"
                            color="neutral"
                            :disabled="!scheduleAtLocal"
                            :loading="publishing || saving"
                            @click="schedulePublish"
                        />
                    </div>
                </div>
            </UCard>
        </template>
    </UDashboardPanel>
</template>
