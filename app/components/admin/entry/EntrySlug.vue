<script setup lang="ts">
const model = defineModel<string>()
const manual = defineModel<boolean>('manual', { required: true })
withDefaults(defineProps<{ label?: string; name?: string; error?: string }>(), {
    label: 'Slug',
    name: 'data.slug',
})
</script>

<template>
    <div class="border-default grid gap-3 border-t pt-4">
        <label class="flex w-fit items-center gap-2 text-sm">
            <input v-model="manual" type="checkbox" class="accent-current" />
            Enter {{ label.toLowerCase() }} manually
        </label>
        <AdminEntryText
            v-if="manual"
            v-model="model"
            :label="label"
            :name="name"
            :error="error"
            required
        />
    </div>
</template>
