import equal from 'fast-deep-equal'
import type { z } from 'zod'

import { LazyAdminModalSkill } from '#components'

export const useSkill = () => {
    const toast = useToast()
    const overlay = useOverlay()

    const { data: skills, refresh: fetchSkills } = useFetch('/api/skills', {
        dedupe: 'defer',
        default: () => [],
        getCachedData: (key, n, ctx) =>
            ctx.cause !== 'refresh:manual' && n.isHydrating
                ? n.payload.data[key]
                : n.static.data[key],
        onResponse: (value) => {
            original.value = value.response._data || []
        },
    })
    const original = shallowRef(skills.value)

    const changed = computed(() => !equal(skills.value, original.value))

    const categories = computed<string[]>(() =>
        [...new Set(skills.value.map((skill) => skill.category))].filter(
            (category): category is string => !!category
        )
    )

    const submitting = ref(false)

    const modalSkill = overlay.create(LazyAdminModalSkill, {
        props: {
            categories: categories.value,
        },
    })

    const createSkill = async (state: Partial<Skill>) => {
        submitting.value = true

        try {
            await $fetch('/api/skills', {
                method: 'POST',
                body: state,
            })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Skill saved successfully',
                color: 'success',
            })

            await fetchSkills()
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the skill',
                color: 'error',
            })
            throw e
        } finally {
            submitting.value = false
        }
    }

    const updateSkill = async (id: Skill['id'], item: z.infer<typeof skillsUpdateSchema>) => {
        try {
            await $fetch(`/api/skills/${id}`, {
                method: 'PATCH',
                body: item,
            })

            await fetchSkills()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Skill saved successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the skill',
                color: 'error',
            })
            throw e
        }
    }

    const reorderSkills = async () => {
        try {
            await $fetch('/api/skills', {
                method: 'PUT',
                body: {
                    skills: skills.value,
                },
            })

            await fetchSkills()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Saved',
                description: 'Your changes have been saved',
                color: 'success',
            })
        } catch {
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'Failed to save changes',
                color: 'error',
            })
        }
    }

    const deleteSkill = async (id: Skill['id']) => {
        try {
            if (!(await confirm('Are you sure you want to delete this skill?'))) return

            await $fetch(`/api/skills/${id}`, {
                method: 'DELETE',
            })

            await fetchSkills()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Skill deleted successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while deleting the skill',
                color: 'error',
            })
            throw e
        }
    }

    return {
        skills,
        changed,
        categories,
        fetchSkills,
        createSkill,
        updateSkill,
        deleteSkill,
        reorderSkills,
        submitting,
        modalSkill,
    }
}
