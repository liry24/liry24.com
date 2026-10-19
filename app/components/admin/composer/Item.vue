<script setup lang="ts">
interface Props {
    item: ComposerItem
    pending: boolean
}
const { item, pending } = defineProps<Props>()

const emit = defineEmits<{
    select: [model?: ComposerModel, entryId?: string]

    ready: [submit: (() => Promise<void>) | undefined]
}>()

const { open, saved } = useAdminComposer()

const plan = computed(() => item.plan)

const labels = {
    works: 'Works',
    arts: 'Arts',
    careers: 'Careers',
    skills: 'Skills',
    games: 'Games',
    gameStats: 'Game Stats',
    socials: 'Socials',
    posts: 'Posts',
}

const target = computed(() =>
    plan.value?.intent === 'settings'
        ? '/admin/settings'
        : {
              path: plan.value?.model ? '/admin/' + plan.value.model : '/admin',

              query: plan.value?.query ? { q: plan.value.query } : undefined,
          },
)

const edit = (model: ComposerModel, id: string) => {
    if (model === 'posts') {
        open.value = false
        return navigateTo('/admin/posts/' + encodeURIComponent(id))
    }
    emit('select', model, id)
}
</script>

<template>
    <section class="grid min-w-0 gap-3" :data-composer-item="item.id">
        <UAlert v-if="saved[item.id]" title="Saved" color="success" />

        <UAlert v-else-if="item.error" :title="item.error" color="warning">
            <template #actions
                ><UButton
                    label="Retry item"
                    :disabled="pending"
                    @click="emit('select', item.model)"
            /></template>
        </UAlert>

        <template v-else-if="plan">
            <UAlert
                v-if="plan.dateIncomplete"
                title="Choose a date and time"
                description="The requested date or time needs clarification."
                color="warning"
            />

            <div v-if="!plan.model || plan.intent === 'clarify'" class="grid gap-3">
                <p class="text-sm">どの種類のデータを追加しますか？</p>

                <div class="flex flex-wrap gap-2">
                    <UButton
                        v-for="model in composerModels"
                        :key="model"
                        :label="labels[model]"
                        color="neutral"
                        variant="soft"
                        :disabled="pending"
                        @click="emit('select', model)"
                    />
                </div>
            </div>

            <template v-else-if="plan.intent === 'create' || plan.intent === 'edit'">
                <AdminComposerPost
                    v-if="plan.model === 'posts'"
                    :key="item.id + ':posts'"
                    :item-id="item.id"
                    :plan
                    :pending
                />

                <Suspense v-else :key="item.id + ':' + plan.model + ':' + (plan.entryId ?? 'new')">
                    <AdminComposerEntry
                        :item-id="item.id"
                        :plan
                        :pending
                        @saved="saved[item.id] = true"
                        @ready="(submit) => emit('ready', submit)"
                    />

                    <template #fallback><USkeleton class="h-40 w-full" /></template>
                </Suspense>
            </template>

            <AdminComposerSurface v-else :plan>
                <template #results>
                    <div class="grid gap-2">
                        <p v-if="!plan.results.length" class="text-muted text-sm">
                            No matching entries.
                        </p>

                        <UButton
                            v-for="entry in plan.results"
                            :key="entry.id"
                            :label="entry.title"
                            color="neutral"
                            variant="soft"
                            trailing-icon="mingcute:arrow-right-line"
                            :disabled="pending"
                            @click="edit(entry.model, entry.id)"
                        />

                        <p v-if="plan.total > plan.results.length" class="text-muted text-xs">
                            {{ plan.total }} matches. Open the full screen to see all.
                        </p>
                    </div>
                </template>

                <template #action
                    ><UButton
                        :to="target"
                        :label="plan.intent === 'settings' ? 'Open Settings' : 'Open full screen'"
                        color="neutral"
                        block
                        :disabled="pending"
                        @click="open = false"
                /></template>
            </AdminComposerSurface>
        </template>
    </section>
</template>
