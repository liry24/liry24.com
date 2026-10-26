type Value = Record<string, unknown>

export const composerValueUpdates = (current: Value, baseline: Value, proposed: Value): Value =>
    Object.fromEntries(
        Object.entries(proposed).filter(
            ([key]) => JSON.stringify(current[key]) === JSON.stringify(baseline[key]),
        ),
    )
