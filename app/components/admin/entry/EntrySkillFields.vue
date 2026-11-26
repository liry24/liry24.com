<script setup lang="ts">
const data = defineModel<AdminEntryData>({ required: true })
defineProps<{ errors: Record<string, string> }>()
defineEmits<{ search: [event: MouseEvent] }>()
</script>

<template>
    <div class="grid gap-4">
        <div class="ui-card flex min-w-0 items-center gap-3 p-4" aria-label="Skill preview">
            <span class="bg-muted inline-grid size-12 shrink-0 place-items-center rounded-lg">
                <Icon
                    :name="data.icon || 'mingcute:tool-line'"
                    class="text-xl"
                    aria-hidden="true"
                />
            </span>
            <div class="min-w-0 break-words">
                <p class="font-semibold">{{ data.name || 'Skill name' }}</p>
                <p v-if="data.category" class="text-muted mt-0.5 text-sm">{{ data.category }}</p>
            </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
            <AdminEntryText
                v-model="data.name"
                label="Name"
                name="data.name"
                :error="errors['data.name']"
                required
            />
            <AdminEntryText
                v-model="data.category"
                label="Category"
                name="data.category"
                :error="errors['data.category']"
            />
        </div>
        <AdminEntryIcon
            v-model="data.icon"
            :error="errors['data.icon']"
            required
            @search="$emit('search', $event)"
        />
        <AdminEntryText
            v-model="data.slug"
            label="Slug"
            name="data.slug"
            :error="errors['data.slug']"
            :suggestion="entrySlugSuggestion(data.name ?? '')"
            required
        />
    </div>
</template>
