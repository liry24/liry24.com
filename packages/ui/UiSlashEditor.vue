<script setup lang="ts">
import {
    createTokenInputController,
    fromText,
    toText,
    TokenInput,
    TokenInputEditor,
    TokenInputToken,
    TokenInputTokenRemove,
} from '@ui-sdk/vue/token-input'
import type {
    Token,
    TokenCodec,
    TokenInputValue,
    TokenInputValueChangeDetails,
    TokenInsert,
} from '@ui-sdk/vue/token-input'
import {
    TriggerMenu,
    TriggerMenuContent,
    TriggerMenuEmpty,
    TriggerMenuHint,
    TriggerMenuList,
    TriggerMenuStatus,
} from '@ui-sdk/vue/trigger-menu'
import type { TriggerDefinition, TriggerMenuSelectDetails } from '@ui-sdk/vue/trigger-menu'
import { onMounted, onUnmounted, shallowRef, useTemplateRef, watch, watchPostEffect } from 'vue'
import type { VNode } from 'vue'

import { highlightMarkdown } from './markdown'

const props = defineProps<{
    codec: TokenCodec
    triggers: Array<TriggerDefinition>
    placeholder: string
    multiline?: boolean
    disabled?: boolean
    required?: boolean
    menuMessage?: (trigger: string | null, argument: string | null) => string
    onSelect?: (
        value: string,
        details: TriggerMenuSelectDetails,
        precedingLine: string,
    ) => void | Promise<Partial<TokenInsert>>
}>()

defineSlots<{
    token?: (props: { token: Token }) => Array<VNode>
}>()

const model = defineModel<string>({ required: true })
const root = useTemplateRef('root')
const controller = createTokenInputController()
const normalize = (text: string) => (props.multiline ? text : text.replaceAll(/\r\n|[\r\n]/g, ' '))
const codec: TokenCodec = {
    format: (token) => props.codec.format(token),
    parse: (text) => props.codec.parse(normalize(text)),
}
const value = shallowRef(fromText(model.value, codec))
let lastEmitted = model.value

watch(model, (source) => {
    if (source === lastEmitted) return
    if (source !== toText(value.value, codec)) value.value = fromText(source, codec)
    lastEmitted = source
})

function updateValue(next: TokenInputValue, details: TokenInputValueChangeDetails) {
    if (!props.multiline && next.some((part) => typeof part === 'string' && /[\r\n]/.test(part))) {
        details.cancel()
        return
    }
    value.value = next
    lastEmitted = toText(next, codec)
    model.value = lastEmitted
}

function preventLineBreak(event: InputEvent) {
    if (!props.multiline && ['insertParagraph', 'insertLineBreak'].includes(event.inputType)) {
        event.preventDefault()
        event.stopPropagation()
    }
}

function waitForMenuResults(event: KeyboardEvent) {
    if (event.isComposing || !['Enter', 'Tab'].includes(event.key)) return

    const editor = controller.editor.element
    if (event.target !== editor) return

    const menuId = editor?.getAttribute('aria-controls')
    if (
        menuId &&
        editor?.ownerDocument.getElementById(menuId)?.getAttribute('aria-busy') === 'true'
    ) {
        event.stopPropagation()
        if (event.key === 'Enter') event.preventDefault()
    }
}

// The SDK handles shortcuts at document capture. Stop stale selections one phase earlier.
onMounted(() => window.addEventListener('keydown', waitForMenuResults, true))
onUnmounted(() => window.removeEventListener('keydown', waitForMenuResults, true))

function select(item: string, details: TriggerMenuSelectDetails) {
    const before = controller.editor.textBefore(details.match.end)
    const prefix = before?.text.slice(0, details.match.start - before.offset) ?? ''
    return props.onSelect?.(item, details, prefix.slice(prefix.lastIndexOf('\n') + 1))
}

let highlighted = false
watchPostEffect((onCleanup) => {
    if (!props.multiline || !value.value.length) return

    const editor = root.value?.querySelector<HTMLElement>('[data-slot="token-input-editor"]')
    if (!editor) return

    let clear: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const highlight = () => {
        clear = highlightMarkdown(editor)
    }
    if (highlighted) timer = setTimeout(highlight, 50)
    else {
        highlighted = true
        highlight()
    }
    onCleanup(() => {
        clearTimeout(timer)
        clear?.()
    })
})
</script>

<template>
    <div ref="root" class="ui-slash-editor">
        <TokenInput
            :controller="controller"
            :value="value"
            :codec="codec"
            :disabled="disabled"
            :required="required"
            @value-change="updateValue"
        >
            <TokenInputEditor
                class="ui-input ui-editor"
                :class="{ 'ui-editor-multiline': multiline }"
                :placeholder="placeholder"
                @beforeinput.capture="preventLineBreak"
            >
                <template #render="{ props: editorProps }">
                    <div v-bind="editorProps" :aria-multiline="multiline ? 'true' : 'false'" />
                </template>
            </TokenInputEditor>
            <TriggerMenu :triggers="triggers" :on-select="select">
                <TriggerMenuHint class="ui-command-hint" />
                <TriggerMenuStatus class="ui-visually-hidden" />
                <TriggerMenuContent
                    class="ui-command-menu"
                    :side-offset="8"
                    :collision-padding="12"
                    v-slot="{ state }"
                >
                    <TriggerMenuList v-show="state.status !== 'loading'" />
                    <p
                        v-if="state.status === 'loading'"
                        class="ui-command-message"
                        aria-hidden="true"
                    >
                        Searching…
                    </p>
                    <TriggerMenuEmpty
                        v-show="state.status !== 'loading'"
                        class="ui-command-message"
                    >
                        No matches
                    </TriggerMenuEmpty>
                    <p class="ui-command-message">
                        {{ menuMessage?.(state.trigger, state.argument) }}
                    </p>
                </TriggerMenuContent>
            </TriggerMenu>
            <template #token="{ token }">
                <TokenInputToken class="ui-token">
                    <slot name="token" :token="token">{{ token.label }}</slot>
                    <TokenInputTokenRemove class="ui-token-remove">×</TokenInputTokenRemove>
                </TokenInputToken>
            </template>
        </TokenInput>
    </div>
</template>
