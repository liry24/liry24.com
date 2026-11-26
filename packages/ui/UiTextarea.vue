<script setup lang="ts">
import { Textarea } from '@ui-sdk/vue/textarea'

const model = defineModel<string>()
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
    <Textarea
        v-model:value="model"
        :rows="rows"
        :style="{ '--textarea-rows': rows }"
        class="ui-input ui-textarea"
        auto-resize
    />
</template>
