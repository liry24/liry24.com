export function composerValueUpdates(
    current: Record<string, unknown>,
    baseline: Record<string, unknown>,
    proposed: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(proposed).filter(
            ([key]) => JSON.stringify(current[key]) === JSON.stringify(baseline[key]),
        ),
    )
}
