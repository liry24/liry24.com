<script setup lang="ts">
import { Primitive } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

interface Props {
    text: string
    duration?: number
    as?: string
    class?: HTMLAttributes['class']
}
const { text, duration = 800, as = 'span', class: className = undefined } = defineProps<Props>()

const alphabet = 'abcdefghijklmnopqrstuvwxyz'
const displayText = ref(text.split(''))
const iterations = ref(0)

const getRandomLetter = () => alphabet[Math.floor(Math.random() * alphabet.length)] || ''

const { pause, resume } = useIntervalFn(
    () => {
        if (iterations.value < text.length) {
            displayText.value = displayText.value.map((l, i) =>
                l === ' ' ? l : i <= iterations.value ? (text[i] ?? '') : getRandomLetter(),
            )
            iterations.value += 0.1
        } else pause()
    },
    computed(() => duration / (text.length * 10)),
)

watch(
    () => text,
    (newText) => {
        displayText.value = newText.split('')
        iterations.value = 0
        pause()
        resume()
    },
)
</script>

<template>
    <Primitive :as="as" :class="cn('flex', className)">
        <span
            v-for="(letter, i) in displayText"
            :key="i"
            :class="cn('inline-block', letter === ' ' ? 'w-3' : '')"
        >
            {{ letter }}
        </span>
    </Primitive>
</template>
