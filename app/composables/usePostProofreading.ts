type ProofreadingForm = {
    state: { values: { content: string } }
    setFieldValue(name: 'content', value: string): void
    atom: {
        subscribe(listener: (state: { values: { content: string } }) => void): {
            unsubscribe(): void
        }
    }
}

export const usePostProofreading = (
    form: ProofreadingForm,
    options: { identity: () => unknown; blocked: () => boolean },
) => {
    const content = shallowRef(form.state.values.content)
    const subscription = form.atom.subscribe((state) => {
        content.value = state.values.content
    })
    onScopeDispose(() => subscription.unsubscribe())
    const input = shallowRef({ content: '' })
    const action = useAi('proofread', { input, immediate: false })
    const proposal = action.data
    const running = computed(() => action.status.value === 'pending')
    const stale = computed(() => Boolean(proposal.value && content.value !== input.value.content))
    const invalid = computed(() =>
        Boolean(
            proposal.value &&
            (typeof proposal.value.content !== 'string' || !proposal.value.content.trim()),
        ),
    )
    const originalContent = computed(() => input.value.content)
    const discard = () => action.clear()
    watch(options.identity, discard, { flush: 'sync' })
    const run = async () => {
        if (options.blocked() || running.value || !content.value.trim()) return
        discard()
        input.value = { content: content.value }
        await action.execute()
    }
    const apply = () => {
        if (options.blocked() || running.value || invalid.value || stale.value || !proposal.value)
            return
        form.setFieldValue('content', proposal.value.content)
        discard()
    }
    return {
        proposal,
        error: action.error,
        running,
        stale,
        invalid,
        originalContent,
        discard,
        run,
        apply,
    }
}
