<script setup lang="ts">
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

import { gameFieldsSchema, gameStatsFieldsSchema } from '../../../shared/schemas/content'
import type {
    ArtData,
    CareerData,
    GameRecordData,
    GameStatsRecordData,
    MediaReference,
    PortfolioCollectionName,
    RankData,
    SkillData,
    SocialData,
    WorkData,
} from '../../../shared/schemas/content'

type FormEndpointName =
    | 'work'
    | 'art'
    | 'career'
    | 'skill'
    | 'game'
    | 'game-stats'
    | 'rank'
    | 'social'

interface CollectionMeta {
    title: string
    icon: string
    formName: FormEndpointName
}

const metaByModel: Record<PortfolioCollectionName, CollectionMeta> = {
    works: { title: 'Works', icon: 'mingcute:briefcase-fill', formName: 'work' },
    arts: { title: 'Arts', icon: 'mingcute:palette-fill', formName: 'art' },
    careers: { title: 'Careers', icon: 'mingcute:building-2-fill', formName: 'career' },
    skills: { title: 'Skills', icon: 'mingcute:tool-fill', formName: 'skill' },
    games: { title: 'Games', icon: 'mingcute:game-2-fill', formName: 'game' },
    gameStats: { title: 'Game Stats', icon: 'mingcute:chart-line-fill', formName: 'game-stats' },
    ranks: { title: 'Ranks', icon: 'mingcute:trophy-fill', formName: 'rank' },
    socials: { title: 'Socials', icon: 'mingcute:link-2-fill', formName: 'social' },
}

const route = useRoute()
const toast = useToast()

const modelParam = String(route.params.model ?? '')
if (!(modelParam in metaByModel)) {
    throw createError({ status: 404, statusText: 'Model not found' })
}
const model = modelParam as PortfolioCollectionName
const meta = metaByModel[model]
useHead({ title: meta.title })

interface AdminEditableFields {
    title?: string
    slug?: string
    description?: string
    category?: string
    icon?: string | MediaReference
    href?: string
    style?: 'large' | 'small'
    image?: MediaReference
    images?: Array<MediaReference>
    company?: string
    period?: string
    position?: string
    name?: string
    igdbId?: number
    primaryMetric?: string
    metrics?: Array<GameMetric>
    game?: string
    periodKey?: string
    values?: Array<GameValue>
    rank?: string
    season?: string
    label?: string
    order?: number
}

interface AdminItem {
    id: string
    title: string
    data: AdminEditableFields
    status: ContentDocumentStatus | null
    schedule: ContentSchedule | null
}

type ModelFormSubmission = {
    id?: string
    data: AdminEditableFields
}

type AdminStringKey =
    | 'title'
    | 'slug'
    | 'description'
    | 'category'
    | 'icon'
    | 'href'
    | 'style'
    | 'company'
    | 'period'
    | 'position'
    | 'name'
    | 'primaryMetric'
    | 'game'
    | 'periodKey'
    | 'rank'
    | 'season'
    | 'label'

const { data, pending, error, refresh } = await useFetch<{
    items: Array<AdminItem>
}>(`/api/admin/content/${encodeURIComponent(model)}`)

const { data: savedGamesData, refresh: refreshGames } = await useFetch<{
    items: Array<{ id: string; data: GameRecordData }>
}>('/api/admin/content/games', {
    immediate: model === 'gameStats' || model === 'games',
})

const items = computed(() => data.value?.items ?? [])
const savedGames = computed(() => savedGamesData.value?.items ?? [])

const busyId = ref<string | null>(null)
const editorOpen = ref(false)
const saving = ref(false)
const uploading = ref(false)
const formError = ref('')
const errors = ref<Record<string, string>>({})

const editingId = ref('')
const formData = ref<AdminEditableFields>({})
const jsonExtraText = ref('')

// IGDB search state for games
const igdbQuery = ref('')
const {
    games: igdbResults,
    warning: igdbWarning,
    loading: igdbSearching,
    importing: igdbImporting,
    importGame,
} = useGameSearch(() =>
    model === 'games' && igdbQuery.value.trim() ? igdbQuery.value.trim() : null,
)

function stringField(key: AdminStringKey): string {
    const val = formData.value[key]
    return typeof val === 'string' ? val : ''
}

function setStringField(key: AdminStringKey, value: string | number) {
    if (key === 'style') {
        formData.value = {
            ...formData.value,
            style: value === 'large' ? 'large' : 'small',
        }
        return
    }
    const next: AdminEditableFields = { ...formData.value }
    next[key] = typeof value === 'number' ? String(value) : value
    formData.value = next
}

function setOrderField(value: string | number) {
    formData.value = {
        ...formData.value,
        order: Number(value) || 0,
    }
}

function defaultRecord(): AdminEditableFields {
    if (model === 'works') {
        const entry: WorkData = {
            title: '',
            slug: '',
            style: 'small',
            order: 0,
        }
        return entry
    }
    if (model === 'arts') {
        const entry: ArtData = {
            title: '',
            slug: '',
            images: [],
            order: 0,
        }
        return entry
    }
    if (model === 'careers') {
        const entry: CareerData = {
            company: '',
            slug: '',
            period: '',
            position: '',
            order: 0,
        }
        return entry
    }
    if (model === 'skills') {
        const entry: SkillData = {
            name: '',
            slug: '',
            icon: '',
            order: 0,
        }
        return entry
    }
    if (model === 'games') {
        const entry: GameRecordData = {
            igdbId: 1,
            slug: '',
            name: '',
            order: 0,
            metrics: [],
        }
        return entry
    }
    if (model === 'gameStats') {
        const entry: GameStatsRecordData = {
            game: savedGames.value[0]?.id ?? '',
            periodKey: '',
            period: '',
            order: 0,
            values: [],
        }
        return entry
    }
    if (model === 'ranks') {
        const entry: RankData = {
            game: '',
            rank: '',
            image: { pathname: '' },
            order: 0,
        }
        return entry
    }
    const entry: SocialData = {
        label: '',
        slug: '',
        href: 'https://liry24.com',
        icon: '',
        order: 0,
    }
    return entry
}

const openCreate = () => {
    editingId.value = ''
    formError.value = ''
    errors.value = {}
    formData.value = defaultRecord()
    jsonExtraText.value = model === 'games' || model === 'gameStats' ? '[]' : ''
    editorOpen.value = true
}

const openEdit = (item: AdminItem) => {
    editingId.value = item.id
    formError.value = ''
    errors.value = {}
    formData.value = { ...item.data }
    if (model === 'games') {
        jsonExtraText.value = JSON.stringify(item.data.metrics ?? [], null, 2)
    } else if (model === 'gameStats') {
        jsonExtraText.value = JSON.stringify(item.data.values ?? [], null, 2)
    } else {
        jsonExtraText.value = ''
    }
    editorOpen.value = true
}

const uploadImage = async (event: Event, target: 'single' | 'cover' | 'art-append') => {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) {
        return
    }
    uploading.value = true
    try {
        const body = new FormData()
        body.append('file', file)
        body.append('folder', model)
        const uploaded = await $fetch<MediaReference>('/api/admin/media', {
            method: 'POST',
            body,
        })
        if (target === 'art-append') {
            const current = formData.value.images ?? []
            formData.value = { ...formData.value, images: [...current, uploaded] }
        } else if (target === 'cover') {
            formData.value = { ...formData.value, icon: uploaded }
        } else {
            formData.value = { ...formData.value, image: uploaded }
        }
        toast.add({ title: 'Uploaded image', color: 'success' })
    } catch (error_) {
        toast.add({
            title: 'Upload failed',
            description: adminErrorMessage(error_, 'Could not upload image.'),
            color: 'error',
        })
    } finally {
        uploading.value = false
        if (input) {
            input.value = ''
        }
    }
}

const saveRecord = async () => {
    saving.value = true
    formError.value = ''
    errors.value = {}
    try {
        const payloadData: AdminEditableFields = { ...formData.value }
        if (model === 'games') {
            payloadData.igdbId = Number(payloadData.igdbId)
            payloadData.metrics = gameFieldsSchema.shape.metrics.parse(
                JSON.parse(jsonExtraText.value || '[]'),
            )
        } else if (model === 'gameStats') {
            payloadData.values = gameStatsFieldsSchema.shape.values.parse(
                JSON.parse(jsonExtraText.value || '[]'),
            )
        }
        if (payloadData.order !== undefined) {
            payloadData.order = Number(payloadData.order) || 0
        }

        const payload: ModelFormSubmission = editingId.value
            ? { id: editingId.value, data: payloadData }
            : { data: payloadData }

        const [submitError] = await submitForm(meta.formName, payload)
        if (submitError) {
            formError.value = submitError.message
            errors.value = fieldErrors(submitError)
            return
        }

        toast.add({ title: 'Saved draft', color: 'success' })
        editorOpen.value = false
        await refresh()
    } catch (error_) {
        formError.value = adminErrorMessage(error_, 'Invalid field data.')
    } finally {
        saving.value = false
    }
}

const handleImportGame = async (game: GameSearchResult) => {
    const saved = await importGame(game)
    if (saved) {
        toast.add({ title: `Imported ${saved.name}`, color: 'success' })
        await refresh()
        await refreshGames()
    }
}

const publishItem = async (item: AdminItem) => {
    busyId.value = item.id
    try {
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'publish',
                collection: model,
                id: item.id,
                digest: item.status?.draft ?? null,
            },
        })
        toast.add({ title: 'Published item', color: 'success' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Publish failed',
            description: adminErrorMessage(error_, 'Could not publish item.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const deleteItem = async (item: AdminItem) => {
    busyId.value = item.id
    try {
        await $fetch(
            `/api/admin/content/${encodeURIComponent(model)}/${encodeURIComponent(item.id)}`,
            {
                method: 'DELETE',
                query: { publish: 'true' },
            },
        )
        toast.add({ title: 'Deleted item', color: 'neutral' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Delete failed',
            description: adminErrorMessage(error_, 'Could not delete item.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const itemLabel = (item: AdminItem) =>
    String(
        item.data.title ??
            item.data.name ??
            item.data.label ??
            item.data.company ??
            item.data.period ??
            item.data.game ??
            item.id,
    )
</script>

<template>
    <UDashboardPanel
        :id="`model-${model}`"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-4 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar :title="meta.title" :icon="meta.icon">
                <template #right>
                    <UButton
                        icon="mingcute:refresh-2-line"
                        aria-label="Refresh items"
                        variant="ghost"
                        color="neutral"
                        :loading="pending"
                        @click="refresh()"
                    />
                    <UButton
                        v-if="model !== 'games'"
                        label="Add"
                        icon="mingcute:add-line"
                        @click="openCreate"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UAlert
                v-if="error"
                role="alert"
                :title="adminErrorMessage(error, `Failed to load ${meta.title}.`)"
                color="error"
                variant="subtle"
                :ui="{ title: 'text-red-700 dark:text-red-400' }"
            />

            <UCard v-if="model === 'games'">
                <div class="flex flex-col gap-3">
                    <h2 class="text-sm font-medium">Import from IGDB</h2>
                    <UInput
                        v-model="igdbQuery"
                        placeholder="Search games on IGDB..."
                        :loading="igdbSearching"
                    />
                    <UAlert
                        v-if="igdbWarning"
                        role="status"
                        :title="igdbWarning"
                        color="warning"
                        variant="subtle"
                        :ui="{ title: 'text-amber-800 dark:text-amber-300' }"
                    />
                    <div
                        v-for="result in igdbResults"
                        :key="`${result.igdbId}-${result.slug}`"
                        class="flex items-center justify-between gap-3 text-sm"
                    >
                        <span>{{ result.name }} ({{ result.slug }})</span>
                        <UButton
                            :label="result.id ? 'Imported' : 'Import'"
                            :disabled="Boolean(result.id)"
                            :loading="igdbImporting"
                            size="xs"
                            @click="handleImportGame(result)"
                        />
                    </div>
                </div>
            </UCard>

            <div
                v-if="!pending && !error && items.length === 0"
                class="mx-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
            >
                <AdminHairlineDrawer
                    :label="`No ${meta.title.toLowerCase()} entries`"
                    class="max-w-xs"
                />
                <p class="text-muted text-sm">No {{ meta.title.toLowerCase() }} entries yet.</p>
            </div>

            <div class="flex flex-col gap-3">
                <UCard v-for="item in items" :key="item.id">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-medium">{{ itemLabel(item) }}</span>
                                <UBadge
                                    v-if="item.status?.state"
                                    :label="item.status.state"
                                    :color="
                                        item.status.state === 'published' ? 'success' : 'warning'
                                    "
                                    :class="
                                        item.status.state === 'published'
                                            ? 'text-green-800 dark:text-green-300'
                                            : 'text-amber-800 dark:text-amber-300'
                                    "
                                    variant="subtle"
                                    size="sm"
                                />
                            </div>
                            <p class="text-muted mt-1 font-mono text-xs">{{ item.id }}</p>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <UButton
                                label="Edit"
                                size="xs"
                                variant="outline"
                                color="neutral"
                                @click="openEdit(item)"
                            />
                            <UButton
                                v-if="item.status?.state !== 'published'"
                                label="Publish"
                                size="xs"
                                :loading="busyId === item.id"
                                @click="publishItem(item)"
                            />
                            <UButton
                                label="Delete"
                                size="xs"
                                variant="ghost"
                                color="error"
                                class="text-red-700 dark:text-red-400"
                                :loading="busyId === item.id"
                                @click="deleteItem(item)"
                            />
                        </div>
                    </div>
                </UCard>
            </div>

            <UModal
                v-model:open="editorOpen"
                :title="editingId ? `Edit ${meta.title}: ${editingId}` : `New ${meta.title}`"
            >
                <template #body>
                    <div class="flex flex-col gap-4">
                        <UAlert
                            v-if="formError"
                            role="alert"
                            :title="formError"
                            color="error"
                            variant="subtle"
                            :ui="{ title: 'text-red-700 dark:text-red-400' }"
                        />

                        <template v-if="model === 'works'">
                            <UFormField label="Title" :error="errors['data.title']" required>
                                <UInput
                                    :model-value="stringField('title')"
                                    @update:model-value="(val) => setStringField('title', val)"
                                />
                            </UFormField>
                            <UFormField label="Slug" :error="errors['data.slug']" required>
                                <UInput
                                    :model-value="stringField('slug')"
                                    @update:model-value="(val) => setStringField('slug', val)"
                                />
                            </UFormField>
                            <UFormField label="Description" :error="errors['data.description']">
                                <UTextarea
                                    :model-value="stringField('description')"
                                    @update:model-value="
                                        (val) => setStringField('description', val)
                                    "
                                />
                            </UFormField>
                            <UFormField label="Category" :error="errors['data.category']">
                                <UInput
                                    :model-value="stringField('category')"
                                    @update:model-value="(val) => setStringField('category', val)"
                                />
                            </UFormField>
                            <UFormField label="Icon" :error="errors['data.icon']">
                                <UInput
                                    :model-value="stringField('icon')"
                                    @update:model-value="(val) => setStringField('icon', val)"
                                />
                            </UFormField>
                            <UFormField label="Href" :error="errors['data.href']">
                                <UInput
                                    :model-value="stringField('href')"
                                    @update:model-value="(val) => setStringField('href', val)"
                                />
                            </UFormField>
                            <UFormField label="Style">
                                <USelect
                                    :model-value="stringField('style') || 'small'"
                                    :items="['large', 'small']"
                                    @update:model-value="(val) => setStringField('style', val)"
                                />
                            </UFormField>
                            <UFormField label="Image">
                                <input
                                    type="file"
                                    accept="image/*"
                                    :disabled="uploading"
                                    @change="(ev) => uploadImage(ev, 'single')"
                                />
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'arts'">
                            <UFormField label="Title" :error="errors['data.title']" required>
                                <UInput
                                    :model-value="stringField('title')"
                                    @update:model-value="(val) => setStringField('title', val)"
                                />
                            </UFormField>
                            <UFormField label="Slug" :error="errors['data.slug']" required>
                                <UInput
                                    :model-value="stringField('slug')"
                                    @update:model-value="(val) => setStringField('slug', val)"
                                />
                            </UFormField>
                            <UFormField label="Description">
                                <UTextarea
                                    :model-value="stringField('description')"
                                    @update:model-value="
                                        (val) => setStringField('description', val)
                                    "
                                />
                            </UFormField>
                            <UFormField label="Href">
                                <UInput
                                    :model-value="stringField('href')"
                                    @update:model-value="(val) => setStringField('href', val)"
                                />
                            </UFormField>
                            <UFormField label="Images" :error="errors['data.images']" required>
                                <input
                                    type="file"
                                    accept="image/*"
                                    :disabled="uploading"
                                    @change="(ev) => uploadImage(ev, 'art-append')"
                                />
                                <p class="text-muted mt-1 text-xs">
                                    Uploaded:
                                    {{
                                        Array.isArray(formData.images) ? formData.images.length : 0
                                    }}
                                </p>
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'careers'">
                            <UFormField label="Company" :error="errors['data.company']" required>
                                <UInput
                                    :model-value="stringField('company')"
                                    @update:model-value="(val) => setStringField('company', val)"
                                />
                            </UFormField>
                            <UFormField label="Slug" :error="errors['data.slug']" required>
                                <UInput
                                    :model-value="stringField('slug')"
                                    @update:model-value="(val) => setStringField('slug', val)"
                                />
                            </UFormField>
                            <UFormField label="Period" :error="errors['data.period']" required>
                                <UInput
                                    :model-value="stringField('period')"
                                    @update:model-value="(val) => setStringField('period', val)"
                                />
                            </UFormField>
                            <UFormField label="Position" :error="errors['data.position']" required>
                                <UInput
                                    :model-value="stringField('position')"
                                    @update:model-value="(val) => setStringField('position', val)"
                                />
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'skills'">
                            <UFormField label="Name" :error="errors['data.name']" required>
                                <UInput
                                    :model-value="stringField('name')"
                                    @update:model-value="(val) => setStringField('name', val)"
                                />
                            </UFormField>
                            <UFormField label="Slug" :error="errors['data.slug']" required>
                                <UInput
                                    :model-value="stringField('slug')"
                                    @update:model-value="(val) => setStringField('slug', val)"
                                />
                            </UFormField>
                            <UFormField label="Icon" :error="errors['data.icon']" required>
                                <UInput
                                    :model-value="stringField('icon')"
                                    @update:model-value="(val) => setStringField('icon', val)"
                                />
                            </UFormField>
                            <UFormField label="Category" :error="errors['data.category']">
                                <UInput
                                    :model-value="stringField('category')"
                                    @update:model-value="(val) => setStringField('category', val)"
                                />
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'games'">
                            <UFormField label="Name" required>
                                <UInput :model-value="stringField('name')" disabled />
                            </UFormField>
                            <UFormField
                                label="Primary metric"
                                :error="errors['data.primaryMetric']"
                            >
                                <UInput
                                    :model-value="stringField('primaryMetric')"
                                    @update:model-value="
                                        (val) => setStringField('primaryMetric', val)
                                    "
                                />
                            </UFormField>
                            <UFormField label="Icon upload">
                                <input
                                    type="file"
                                    accept="image/*"
                                    :disabled="uploading"
                                    @change="(ev) => uploadImage(ev, 'cover')"
                                />
                            </UFormField>
                            <UFormField label="Metrics JSON" :error="errors['data.metrics']">
                                <UTextarea v-model="jsonExtraText" :rows="6" class="font-mono" />
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'gameStats'">
                            <UFormField label="Game ID" :error="errors['data.game']" required>
                                <USelect
                                    :model-value="stringField('game')"
                                    :items="
                                        savedGames.map((entry) => ({
                                            label: entry.data.name,
                                            value: entry.id,
                                        }))
                                    "
                                    @update:model-value="(val) => setStringField('game', val)"
                                />
                            </UFormField>
                            <UFormField
                                label="Period key"
                                :error="errors['data.periodKey']"
                                required
                            >
                                <UInput
                                    :model-value="stringField('periodKey')"
                                    @update:model-value="(val) => setStringField('periodKey', val)"
                                />
                            </UFormField>
                            <UFormField
                                label="Period label"
                                :error="errors['data.period']"
                                required
                            >
                                <UInput
                                    :model-value="stringField('period')"
                                    @update:model-value="(val) => setStringField('period', val)"
                                />
                            </UFormField>
                            <UFormField label="Values JSON" :error="errors['data.values']">
                                <UTextarea v-model="jsonExtraText" :rows="6" class="font-mono" />
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'ranks'">
                            <UFormField label="Game" :error="errors['data.game']" required>
                                <UInput
                                    :model-value="stringField('game')"
                                    @update:model-value="(val) => setStringField('game', val)"
                                />
                            </UFormField>
                            <UFormField label="Rank" :error="errors['data.rank']" required>
                                <UInput
                                    :model-value="stringField('rank')"
                                    @update:model-value="(val) => setStringField('rank', val)"
                                />
                            </UFormField>
                            <UFormField label="Season">
                                <UInput
                                    :model-value="stringField('season')"
                                    @update:model-value="(val) => setStringField('season', val)"
                                />
                            </UFormField>
                            <UFormField label="Image" :error="errors['data.image']" required>
                                <input
                                    type="file"
                                    accept="image/*"
                                    :disabled="uploading"
                                    @change="(ev) => uploadImage(ev, 'single')"
                                />
                            </UFormField>
                        </template>

                        <template v-else-if="model === 'socials'">
                            <UFormField label="Label" :error="errors['data.label']" required>
                                <UInput
                                    :model-value="stringField('label')"
                                    @update:model-value="(val) => setStringField('label', val)"
                                />
                            </UFormField>
                            <UFormField label="Slug" :error="errors['data.slug']" required>
                                <UInput
                                    :model-value="stringField('slug')"
                                    @update:model-value="(val) => setStringField('slug', val)"
                                />
                            </UFormField>
                            <UFormField label="Href" :error="errors['data.href']" required>
                                <UInput
                                    :model-value="stringField('href')"
                                    @update:model-value="(val) => setStringField('href', val)"
                                />
                            </UFormField>
                            <UFormField label="Icon" :error="errors['data.icon']" required>
                                <UInput
                                    :model-value="stringField('icon')"
                                    @update:model-value="(val) => setStringField('icon', val)"
                                />
                            </UFormField>
                        </template>

                        <UFormField label="Order">
                            <UInput
                                type="number"
                                :model-value="Number(formData.order ?? 0)"
                                @update:model-value="(val) => setOrderField(val)"
                            />
                        </UFormField>

                        <div class="flex justify-end gap-2">
                            <UButton
                                label="Cancel"
                                variant="ghost"
                                color="neutral"
                                @click="editorOpen = false"
                            />
                            <UButton label="Save draft" :loading="saving" @click="saveRecord" />
                        </div>
                    </div>
                </template>
            </UModal>
        </template>
    </UDashboardPanel>
</template>
