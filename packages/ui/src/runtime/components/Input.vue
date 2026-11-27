<script setup lang="ts">
import { Input } from '@ui-sdk/vue/input'

const model = defineModel<string>()
</script>

<template>
    <Input v-model="model" class="ui-input" />
</template>
