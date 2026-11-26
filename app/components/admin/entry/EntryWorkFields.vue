<script setup lang="ts">
const data = defineModel<AdminEntryData>({ required: true })
defineProps<{ errors: Record<string, string>; busy: boolean }>()
defineEmits<{ busy: [busy: boolean]; search: [event: MouseEvent] }>()
const styles = [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
] as const
</script>

<template>
    <div class="grid items-start gap-5 sm:grid-cols-[1fr_0.95fr]">
        <section class="grid gap-4" aria-label="Project details">
            <AdminEntryText
                v-model="data.title"
                label="Title"
                name="data.title"
                :error="errors['data.title']"
                required
            />
            <AdminEntryText
                v-model="data.category"
                label="Category"
                name="data.category"
                :error="errors['data.category']"
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
                label="Project URL"
                name="data.href"
                :error="errors['data.href']"
                type="url"
                placeholder="https://"
            />
            <AdminEntryIcon
                v-model="data.icon"
                :error="errors['data.icon']"
                @search="$emit('search', $event)"
            />
        </section>
        <section class="ui-card grid min-w-0 gap-4 p-4" aria-label="Work preview and presentation">
            <fieldset class="grid gap-2">
                <legend class="ui-label mb-2">Card layout</legend>
                <div class="grid grid-cols-2 gap-2">
                    <label
                        v-for="style in styles"
                        :key="style.value"
                        class="border-default has-checked:border-inverted has-checked:bg-elevated flex min-h-10 items-center justify-center gap-2 rounded-lg border p-2 text-sm"
                    >
                        <input
                            v-model="data.style"
                            type="radio"
                            name="data.style"
                            :value="style.value"
                            class="accent-current"
                        />
                        {{ style.label }}
                    </label>
                </div>
            </fieldset>
            <div
                class="bg-muted border-default grid min-w-0 gap-2 rounded-lg border p-3 text-sm"
                aria-label="Listing preview"
            >
                <p v-if="data.category" class="text-toned text-xs break-words">
                    {{ data.category }}
                </p>
                <div :class="data.style === 'large' ? 'grid gap-2' : 'flex items-start gap-3'">
                    <img
                        v-if="data.image"
                        :src="mediaUrl(data.image)"
                        alt=""
                        :class="
                            data.style === 'large'
                                ? 'aspect-video w-full rounded-md object-cover'
                                : 'size-16 shrink-0 rounded-md object-cover'
                        "
                    />
                    <div class="min-w-0">
                        <p class="font-semibold break-words">{{ data.title || 'Project title' }}</p>
                        <p
                            v-if="data.style !== 'large' && data.description"
                            class="text-muted mt-1 line-clamp-3 break-words"
                        >
                            {{ data.description }}
                        </p>
                    </div>
                </div>
            </div>
            <AdminEntryImages
                :model-value="data.image ? [data.image] : []"
                label="Project image"
                folder="works"
                :disabled="busy"
                :error="errors['data.image']"
                @update:model-value="data.image = $event[0]"
                @busy="$emit('busy', $event)"
            />
        </section>
    </div>
</template>
