type ProofreadingForm = {
    state: { values: Record<string, unknown> }
    setFieldValue(name: 'content', value: string): void
}
type ProofreadingDraft = {
    ensure(): Promise<{ id: string; version: number } | undefined>
    snapshot(): PostDraftState
    isStale(snapshot: unknown): boolean
}

export const usePostProofreading = async (
    form: ProofreadingForm,
    draft: ProofreadingDraft,
    blocked: () => boolean,
) => {
    const management = useAdminClient()
    const input = shallowRef({ content: '' })
    const action = await useAi('proofread', { input, immediate: false })
    const proposal = shallowRef<PostEditorialProposal | null>(null)
    const error = shallowRef<Error | null>(null)
    const running = ref(false)
    const stale = computed(() => (proposal.value ? draft.isStale(proposal.value.snapshot) : false))
    const invalid = computed(() =>
        Boolean(
            proposal.value &&
            (typeof proposal.value.data.content !== 'string' ||
                !proposal.value.data.content.trim()),
        ),
    )
    const originalContent = computed(() => String(proposal.value?.snapshot.draft.content ?? ''))
    const discard = () => {
        proposal.value = null
        error.value = null
        action.clear()
    }
    const run = async () => {
        if (blocked() || running.value) return
        discard()
        running.value = true
        try {
            const values = form.state.values
            if (!String(values.title ?? '').trim() || !String(values.content ?? '').trim())
                throw new Error('Write a title and content before using AI.')
            if (!(await draft.ensure())) return
            proposal.value = await preparePostProofreading(
                { management, current: draft.snapshot },
                async (value) => {
                    input.value = value
                    await action.execute()
                    if (action.error.value) throw action.error.value
                    if (!action.data.value)
                        throw new Error('No proofreading suggestion was returned.')
                    return action.data.value
                },
            )
        } catch (cause) {
            error.value =
                cause instanceof Error
                    ? cause
                    : new Error('Proofreading failed. Your content is kept.')
        } finally {
            running.value = false
        }
    }
    const apply = () => {
        if (blocked() || running.value || invalid.value || stale.value || !proposal.value) return
        form.setFieldValue('content', String(proposal.value.data.content))
        discard()
    }
    return { proposal, error, running, stale, invalid, originalContent, discard, run, apply }
}
