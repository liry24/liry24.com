<script setup lang="ts">
const data = defineModel<AdminEntryData>({ required: true })
defineProps<{ errors: Record<string, string> }>()
defineEmits<{ search: [event: MouseEvent] }>()
</script>

<template>
    <div class="grid gap-4">
        <div class="ui-card flex min-w-0 items-center gap-3 p-4" aria-label="Social link preview">
            <span class="bg-muted inline-grid size-12 shrink-0 place-items-center rounded-lg">
                <Icon
                    :name="data.icon || 'mingcute:link-2-fill'"
                    class="text-xl"
                    aria-hidden="true"
                />
            </span>
            <div class="min-w-0 flex-1">
                <p class="font-semibold break-words">{{ data.label || 'Link label' }}</p>
                <p v-if="data.href" class="text-muted mt-0.5 truncate text-sm">{{ data.href }}</p>
            </div>
            <Icon
                name="mingcute:arrow-right-up-line"
                class="text-toned shrink-0"
                aria-hidden="true"
            />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
            <AdminEntryText
                v-model="data.label"
                label="Label"
                name="data.label"
                :error="errors['data.label']"
                required
            />
            <AdminEntryText
                v-model="data.slug"
                label="Slug"
                name="data.slug"
                :error="errors['data.slug']"
                :suggestion="entrySlugSuggestion(data.label ?? '')"
                required
            />
        </div>
        <AdminEntryText
            v-model="data.href"
            label="Link URL"
            name="data.href"
            :error="errors['data.href']"
            type="url"
            placeholder="https://"
            required
        />
        <AdminEntryIcon
            v-model="data.icon"
            :error="errors['data.icon']"
            required
            @search="$emit('search', $event)"
        />
    </div>
</template>
