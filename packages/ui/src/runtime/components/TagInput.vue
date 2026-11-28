<script setup lang="ts">
import {
    Combobox,
    ComboboxChip,
    ComboboxChipRemove,
    ComboboxChips,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
} from '@ui-sdk/vue/combobox'
import { computed, ref, useId } from 'vue'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'

const model = defineModel<Array<string>>({ required: true })
const { suggestions, disabled } = defineProps<{
    suggestions: Array<string>
    disabled?: boolean
}>()

const chipsId = useId()
const icons = useUiIcons()
const query = ref('')
const choices = computed(() => {
    const text = query.value.trim().toLowerCase()
    const selected = new Set(model.value)
    return suggestions
        .filter((tag) => !selected.has(tag) && tag.toLowerCase().includes(text))
        .slice(0, 12)
})

function select(value: unknown) {
    if (Array.isArray(value))
        model.value = value.filter((tag): tag is string => typeof tag === 'string')
}
</script>

<template>
    <Combobox
        v-model:query="query"
        :value="model"
        :items="choices"
        :filter="false"
        :disabled="disabled"
        multiple
        allow-custom-value
        @value-change="select"
    >
        <ComboboxChips :id="chipsId" class="ui-input ui-tag-input">
            <ComboboxChip v-for="tag in model" :key="tag" :value="tag" class="ui-token">
                {{ tag }}
                <ComboboxChipRemove class="ui-token-remove" :aria-label="`Remove ${tag}`">
                    <UIcon :name="icons.close" class="ui-icon ui-icon-xs" aria-hidden="true" />
                </ComboboxChipRemove>
            </ComboboxChip>
            <ComboboxInput class="ui-tag-query" placeholder="Add a tag…" />
            <ComboboxTrigger
                v-if="suggestions.length"
                type="button"
                class="ui-token-remove"
                aria-label="Show tag suggestions"
            >
                <UIcon :name="icons.chevronDown" class="ui-icon ui-icon-xs" aria-hidden="true" />
            </ComboboxTrigger>
        </ComboboxChips>
        <ComboboxContent
            :anchor="`#${chipsId}`"
            :side-offset="4"
            class="ui-search-picker-results ui-tag-results"
        >
            <ComboboxList class="ui-search-picker-list">
                <ComboboxItem
                    v-for="tag in choices"
                    :key="tag"
                    :value="tag"
                    :label="tag"
                    class="ui-search-picker-item"
                >
                    {{ tag }}
                </ComboboxItem>
            </ComboboxList>
        </ComboboxContent>
    </Combobox>
</template>
