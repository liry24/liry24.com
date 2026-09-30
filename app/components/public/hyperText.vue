<script setup lang="ts">
import { cn } from 'cn'
import { Primitive } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

interface Props {
    text: string
    case?: 'upper' | 'lower'
    duration?: number
    animateOnLoad?: boolean
    as?: string
    class?: HTMLAttributes['class']
}
const {
    text,
    case: textCase = 'lower',
    duration = 800,
    animateOnLoad = false,
    as = 'span',
    class: className = undefined,
} = defineProps<Props>()

const emit = defineEmits(['mouseenter', 'mouseleave'])

const alphabets = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
}
const displayText = ref(text.split(''))
const iterations = ref(0)

const getRandomLetter = () =>
    alphabets[textCase][Math.floor(Math.random() * alphabets[textCase].length)] || ''

const triggerAnimation = () => {
    iterations.value = 0
    startAnimation()
}

const { pause, resume } = useIntervalFn(
    () => {
        if (iterations.value < text.length) {
            displayText.value = displayText.value.map((l, i) =>
                l === ' ' ? l : i <= iterations.value ? (text[i] ?? '') : getRandomLetter(),
            )
            iterations.value += 0.1
        } else {
            pause()
        }
    },
    computed(() => duration / (text.length * 10)),
)

const startAnimation = () => {
    pause()
    resume()
}

watch(
    () => text,
    (newText) => {
        displayText.value = newText.split('')
        triggerAnimation()
    },
)

if (animateOnLoad) triggerAnimation()
</script>

<template>
    <Primitive
        :as="as"
        :class="cn('flex', className)"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
    >
        <Motion
            v-for="(letter, i) in displayText"
            :key="i"
            as="span"
            :delay="i * (duration / (text.length * 10))"
            :class="cn('inline-block', letter === ' ' ? 'w-3' : '')"
        >
            {{ letter }}
        </Motion>
    </Primitive>
</template>
