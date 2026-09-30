<script setup lang="ts">
import type { ModelDescriptor } from '@liria24/site-admin'
import { useSiteAdminForm } from '@liria24/site-admin/form'
import type { EntryRecord } from '@liria24/site-admin/server'
const props = defineProps<{ modelName: string; descriptor: ModelDescriptor; data?: EntryRecord }>()
const emit = defineEmits<{ close: [saved: boolean] }>()
const slug = ref(props.data?.slug || '')
const { form, conflict, serverError, asset } = useSiteAdminForm({
    modelName: props.modelName,
    descriptor: props.descriptor,
    entry: props.data,
    get slug() {
        return slug.value || undefined
    },
    onSuccess: () => emit('close', true),
})
const localError = ref('')
async function save() {
    try {
        await form.handleSubmit()
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Save failed'
    }
}
async function upload(event: Event, name: string, multiple: boolean, current: unknown) {
    const input = event.target as HTMLInputElement
    try {
        const uploaded = []
        for (const file of Array.from(input.files ?? []))
            uploaded.push((await asset.upload(file)).id)
        if (multiple)
            form.setFieldValue(name, [...(Array.isArray(current) ? current : []), ...uploaded])
        else if (uploaded[0]) asset.set(name, uploaded[0])
    } catch {
        /* The Site Admin upload controller exposes the failure. */
    }
    input.value = ''
}
</script>

<template>
    <UModal
        :title="`${data ? 'Edit' : 'Create'} ${modelName}`"
        :dismissible="false"
        @update:open="
            (value) => {
                if (!value) emit('close', false)
            }
        "
    >
        <template #body>
            <UAlert
                v-if="conflict"
                title="Conflict detected"
                description="Reload latest before saving again."
                color="warning"
            >
                <template #actions>
                    <UButton label="Reload latest" @click="emit('close', true)" />
                </template>
            </UAlert>

            <UAlert
                v-if="serverError || localError"
                :title="serverError?.message || localError"
                color="error"
            />
            <form class="grid gap-4" @submit.prevent="save">
                <UFormField label="Slug" description="Leave empty to generate an identifier.">
                    <UInput v-model="slug" class="w-full" />
                </UFormField>

                <form.Field
                    v-for="(descriptor, name) in props.descriptor.fields"
                    :key="name"
                    :name="name"
                >
                    <template #default="{ field }">
                        <UFormField
                            :label="descriptor.label || name"
                            :required="descriptor.required"
                            :error="
                                field.errors
                                    .map((error) =>
                                        typeof error === 'string' ? error : error.message,
                                    )
                                    .join(', ')
                            "
                        >
                            <USelect
                                v-if="descriptor.kind === 'select'"
                                :items="[...(descriptor.values || [])]"
                                :model-value="String(field.value ?? '')"
                                @update:model-value="field.handleChange"
                            />
                            <template
                                v-else-if="['image', 'images', 'file'].includes(descriptor.kind)"
                            >
                                <input
                                    type="file"
                                    :multiple="descriptor.kind === 'images'"
                                    :accept="descriptor.accept?.join(',')"
                                    @change="
                                        upload(
                                            $event,
                                            name,
                                            descriptor.kind === 'images',
                                            field.value,
                                        )
                                    "
                                />
                                <progress
                                    v-if="asset.progress.value !== null"
                                    :value="asset.progress.value"
                                    max="1"
                                    aria-label="Upload progress"
                                />
                                <p v-if="asset.error.value" role="alert">{{ asset.error.value }}</p>
                                <p class="text-xs break-all">{{ field.value }}</p>
                                <UButton
                                    label="Clear reference"
                                    variant="ghost"
                                    @click="
                                        descriptor.kind === 'images'
                                            ? field.handleChange([])
                                            : asset.clear(name)
                                    "
                                />
                            </template>
                            <UTextarea
                                v-else-if="descriptor.kind === 'array'"
                                :model-value="
                                    Array.isArray(field.value) ? field.value.join('\n') : ''
                                "
                                placeholder="One tag per line"
                                @update:model-value="
                                    (value) => field.handleChange(value.split('\n').filter(Boolean))
                                "
                            />
                            <UTextarea
                                v-else-if="['textarea', 'markdown'].includes(descriptor.kind)"
                                :model-value="String(field.value ?? '')"
                                :rows="descriptor.kind === 'markdown' ? 16 : 3"
                                class="w-full"
                                @update:model-value="field.handleChange"
                                @blur="field.handleBlur"
                            />
                            <UInput
                                v-else
                                :model-value="String(field.value ?? '')"
                                class="w-full"
                                @update:model-value="field.handleChange"
                                @blur="field.handleBlur"
                            />
                        </UFormField>
                    </template>
                </form.Field>

                <div class="flex justify-end gap-2">
                    <UButton label="Cancel" variant="ghost" @click="emit('close', false)" /><UButton
                        type="submit"
                        label="Save Draft"
                        :disabled="conflict"
                    />
                </div>
            </form>
        </template>
    </UModal>
</template>
