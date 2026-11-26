<script setup lang="ts">
const data = defineModel<AdminEntryData>({ required: true })
defineProps<{ errors: Record<string, string> }>()
</script>

<template>
    <div class="grid gap-4">
        <div
            class="ui-card grid grid-cols-[1fr_auto] items-start gap-3 border-s-2 p-4"
            aria-label="Career preview"
        >
            <div class="min-w-0 break-words">
                <p class="text-highlighted font-semibold">{{ data.company || 'Company' }}</p>
                <p class="text-muted mt-1 text-sm">{{ data.position || 'Position' }}</p>
            </div>
            <p class="text-toned text-end font-mono text-xs wrap-anywhere">
                {{ data.period || 'Period' }}
            </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
            <AdminEntryText
                v-model="data.company"
                label="Company"
                name="data.company"
                :error="errors['data.company']"
                required
            />
            <AdminEntryText
                v-model="data.position"
                label="Position"
                name="data.position"
                :error="errors['data.position']"
                required
            />
            <AdminEntryText
                v-model="data.period"
                label="Period"
                name="data.period"
                :error="errors['data.period']"
                required
                placeholder="2023 – Present"
            />
        </div>
    </div>
</template>
