<script setup lang="ts">
const data = defineModel<AdminEntryData>({ required: true })
defineProps<{ errors: Record<string, string>; busy: boolean }>()
defineEmits<{ busy: [busy: boolean] }>()
</script>

<template>
    <div class="grid items-start gap-5 sm:grid-cols-[1.2fr_0.8fr]">
        <section class="ui-card grid gap-3 p-4" aria-label="Gallery">
            <AdminEntryImages
                :model-value="data.images ?? []"
                label="Gallery images"
                folder="arts"
                :disabled="busy"
                :error="errors['data.images']"
                required
                multiple
                @update:model-value="data.images = $event"
                @busy="$emit('busy', $event)"
            />
            <p class="ui-description">
                The first image is used on the public gallery and home page.
            </p>
        </section>
        <section class="grid gap-4" aria-label="Artwork details">
            <AdminEntryText
                v-model="data.title"
                label="Title"
                name="data.title"
                :error="errors['data.title']"
                required
            />
            <AdminEntryText
                v-model="data.description"
                label="Description"
                name="data.description"
                :error="errors['data.description']"
                :rows="3"
            />
            <AdminEntryText
                v-model="data.href"
                label="Artwork URL"
                name="data.href"
                :error="errors['data.href']"
                type="url"
                placeholder="https://"
            />
        </section>
    </div>
</template>
