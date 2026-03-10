<script setup lang="ts">
import z from 'zod'

const open = defineModel<boolean>('open', {
    default: false,
})

interface Props {
    data?: Serialized<Work> & { image: string | null }
    fields?: {
        slug?: boolean
    }
}
const props = withDefaults(defineProps<Props>(), {
    data: undefined,
    categories: () => [],
    fields: () => ({ slug: false }),
})

const emit = defineEmits(['success'])

const { categories, createWork, updateWork } = useWork()

const schema = worksInsertSchema.extend({
    image: z.object({
        src: z.string(),
        alt: z.string().optional(),
    }),
})
type Schema = z.infer<typeof schema>

const state = reactive<Schema>({
    slug: props.data?.slug || undefined,
    title: props.data?.title || '',
    description: props.data?.description || '',
    category: props.data?.category || '',
    image: {
        src: props.data?.image || '',
        alt: undefined,
    },
    icon: props.data?.icon || '',
    href: props.data?.href || '',
})

const onSubmit = async () => {
    try {
        if (props.data?.slug)
            await updateWork(props.data.slug, {
                ...state,
                image: state.image.src,
            })
        else
            await createWork({
                ...state,
                image: state.image.src,
            })

        state.slug = undefined
        state.title = ''
        state.category = ''
        state.description = ''
        state.image = {
            src: '',
            alt: undefined,
        }
        state.icon = ''
        state.href = ''

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
        :title="props.data?.slug ? 'Edit Work' : 'New Work'"
        :description="props.data?.slug ? `Editing #${props.data.slug}` : 'Add a new work'"
    >
        <slot />

        <template #body>
            <UForm :state :schema class="grid gap-4" @submit="onSubmit">
                <UFormField label="Title" name="title" required>
                    <UInput
                        v-model="state.title"
                        placeholder="Work Title"
                        variant="soft"
                        size="xl"
                        class="w-full"
                    />
                </UFormField>

                <UFormField label="Description" name="description">
                    <UTextarea
                        v-model="state.description"
                        placeholder="Work Description"
                        variant="soft"
                        autoresize
                        :rows="3"
                        class="w-full"
                    />
                </UFormField>

                <UFormField
                    label="Category"
                    name="category"
                    :ui="{ container: 'flex flex-col gap-2' }"
                >
                    <UInput
                        v-model="state.category"
                        placeholder="Web Application"
                        variant="soft"
                        class="w-full"
                    />
                    <div class="flex flex-wrap gap-2">
                        <UButton
                            v-for="(category, index) in categories"
                            :key="`category-${index}`"
                            :label="category"
                            variant="outline"
                            size="sm"
                            @click="state.category = category"
                        />
                    </div>
                </UFormField>

                <UFormField v-if="props.fields.slug" label="Slug" name="slug">
                    <UInput
                        v-model="state.slug"
                        placeholder="work-slug"
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

                <UFormField label="Icon" name="icon">
                    <UInput
                        v-model="state.icon"
                        placeholder="lucide:globe"
                        variant="soft"
                        class="w-full"
                    >
                        <template #trailing>
                            <Icon v-if="state.icon" :name="state.icon" class="size-5" />
                        </template>
                    </UInput>
                </UFormField>

                <UFormField label="Image">
                    <FileUpload
                        v-model="state.image"
                        prefix="work"
                        accept="image/*"
                        label="Upload Image"
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
