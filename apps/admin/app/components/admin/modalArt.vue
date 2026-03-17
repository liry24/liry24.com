<script setup lang="ts">
import z from 'zod'

const open = defineModel<boolean>('open', {
    default: false,
})

interface Props {
    data?: Serialized<Art>
    fields?: {
        slug?: boolean
    }
}
const props = withDefaults(defineProps<Props>(), {
    data: undefined,
    fields: () => ({ slug: true }),
})

const emit = defineEmits(['success'])

const { createArt, updateArt } = useArt()

const schema = artsInsertSchema.extend({
    images: z
        .object({
            src: z.string(),
            alt: z.string().nullable().optional(),
        })
        .array(),
})
type Schema = { [K in keyof z.infer<typeof schema>]: NonNullable<z.infer<typeof schema>[K]> }

const state = reactive<Schema>({
    slug: props.data?.slug || undefined,
    title: props.data?.title || '',
    description: props.data?.description || '',
    href: props.data?.href || '',
    images: props.data?.images || [],
})

const onSubmit = async () => {
    try {
        if (props.data?.slug) await updateArt(props.data.slug, state)
        else await createArt(state)

        state.slug = undefined
        state.title = ''
        state.description = ''
        state.href = ''
        state.images = []

        open.value = false
        emit('success')
    } catch {
        // Error handling in composable
    }
}
</script>

<template>
    <UModal
        v-model:open="open"
        :title="props.data?.slug ? 'Edit Art' : 'New Art'"
        :description="props.data?.slug ? `Editing #${props.data.slug}` : 'Add a new art'"
    >
        <slot />

        <template #body>
            <UForm :state :schema class="grid gap-4" @submit="onSubmit">
                <UFormField label="Images" name="images" required>
                    <FileUpload v-model="state.images" multiple accept="image/*" class="min-h-32" />
                </UFormField>

                <UFormField label="Title" name="title" required>
                    <UInput
                        v-model="state.title"
                        placeholder="Art Title"
                        variant="soft"
                        size="xl"
                        class="w-full"
                    />
                </UFormField>

                <UFormField label="Description" name="description">
                    <UTextarea
                        v-model="state.description"
                        placeholder="Art Description"
                        variant="soft"
                        autoresize
                        :rows="3"
                        class="w-full"
                    />
                </UFormField>

                <UFormField v-if="props.fields?.slug" label="Slug" name="slug">
                    <UInput
                        v-model="state.slug"
                        placeholder="art-slug"
                        variant="soft"
                        class="w-full"
                    />
                </UFormField>

                <UFormField label="URL" name="href">
                    <UInput
                        v-model="state.href"
                        placeholder="https://example.com"
                        variant="soft"
                        class="w-full"
                    />
                </UFormField>
            </UForm>
        </template>

        <template #footer>
            <UButton
                :label="props.data?.slug ? 'Update' : 'Add'"
                color="neutral"
                size="lg"
                block
                loading-auto
                @click="onSubmit"
            />
        </template>
    </UModal>
</template>
