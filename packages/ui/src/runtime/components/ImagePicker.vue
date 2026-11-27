<script setup lang="ts">
import { FileInput, FileInputDropzone } from '@ui-sdk/vue/file-input'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'
import UiButton from './Button.vue'
import UiFileInputTrigger from './FileInputTrigger.vue'

const { label, images, multiple, busy, disabled, accept, maxSize } = defineProps<{
    label: string
    images: Array<{ id: string; src: string; label: string }>
    multiple?: boolean
    busy?: boolean
    disabled?: boolean
    accept: string
    maxSize: number
}>()
const emit = defineEmits<{
    files: [files: Array<File>]
    reject: [files: Array<File>]
    remove: [index: number]
    move: [from: number, to: number]
}>()

const emptyFiles: Array<File> = []
const icons = useUiIcons()
</script>

<template>
    <div class="ui-image-picker" :aria-busy="busy || undefined">
        <ul v-if="images.length" class="ui-image-picker-list" :aria-label="label">
            <li v-for="(image, index) in images" :key="image.id" class="ui-image-picker-item">
                <img :src="image.src" :alt="image.label" />
                <div class="ui-image-picker-actions">
                    <span v-if="multiple && index === 0" class="ui-image-picker-cover">Cover</span>
                    <UiButton
                        v-if="multiple"
                        variant="ghost"
                        size="xs"
                        square
                        :aria-label="`Move image ${index + 1} earlier`"
                        :disabled="disabled || busy || index === 0"
                        @click="emit('move', index, index - 1)"
                    >
                        <UIcon :name="icons.arrowUp" class="ui-icon" aria-hidden="true" />
                    </UiButton>
                    <UiButton
                        v-if="multiple"
                        variant="ghost"
                        size="xs"
                        square
                        :aria-label="`Move image ${index + 1} later`"
                        :disabled="disabled || busy || index === images.length - 1"
                        @click="emit('move', index, index + 1)"
                    >
                        <UIcon :name="icons.arrowDown" class="ui-icon" aria-hidden="true" />
                    </UiButton>
                    <UiButton
                        variant="ghost"
                        size="xs"
                        square
                        :aria-label="multiple ? `Remove image ${index + 1}` : `Remove ${label}`"
                        :disabled="disabled || busy"
                        @click="emit('remove', index)"
                    >
                        <UIcon :name="icons.close" class="ui-icon" aria-hidden="true" />
                    </UiButton>
                </div>
            </li>
        </ul>
        <FileInput
            :value="emptyFiles"
            :multiple="multiple"
            :accept="accept"
            :min-size="1"
            :max-size="maxSize"
            :disabled="disabled || busy"
            @value-change="(files) => files.length && emit('files', files)"
            @reject="
                emit(
                    'reject',
                    $event.map(({ file }) => file),
                )
            "
        >
            <FileInputDropzone class="ui-image-picker-drop">
                <UiFileInputTrigger>
                    <UIcon :name="icons.upload" class="ui-icon" aria-hidden="true" />
                    {{
                        busy
                            ? 'Uploading…'
                            : multiple
                              ? 'Add images'
                              : images.length
                                ? 'Replace image'
                                : 'Choose image'
                    }}
                </UiFileInputTrigger>
                <span class="ui-description"
                    >or drop {{ multiple ? 'images' : 'an image' }} here</span
                >
            </FileInputDropzone>
        </FileInput>
    </div>
</template>
