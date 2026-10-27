import { defineRecordModel, describeModel, field } from '@litijs/model'
import { expect, test } from 'vitest'
import { z } from 'zod'

import { imageSchema } from '../server/utils/imageSchema'
import { adminErrorMessage } from '../shared/utils/adminErrorMessage'
import { modelFields } from '../shared/utils/modelFields'

test('admin thumbnails accept native Blob references and galleries and reject malformed references', () => {
    const reference = { pathname: 'uploads/draft-image.png', contentType: 'image/png', size: 42 }
    expect(imageSchema.parse(reference)).toEqual(reference)
    expect(z.array(imageSchema).parse([reference])).toEqual([reference])
    for (const value of [null, undefined, '', {}, { pathname: 42 }, { id: 'draft-image' }])
        expect(imageSchema.safeParse(value).success).toBe(false)
    expect(z.array(imageSchema).safeParse([reference, { pathname: 42 }]).success).toBe(false)
})

test('admin field labels remain readable and keep model-specific labels', () => {
    const model = defineRecordModel({
        name: 'links',
        authorize: () => true,
        fields: {
            label: field(z.string()),
            primaryMetric: field(z.string().optional()),
            href: field(z.url(), { label: 'URL' }),
        },
    })
    expect(modelFields(describeModel(model)).map(({ label }) => label)).toEqual([
        'Label',
        'Primary Metric',
        'URL',
    ])
})

test('admin errors retain native HTTP messages and safe fallbacks', () => {
    expect(
        adminErrorMessage(
            { data: { message: 'Reorder conflict', data: { code: 'LITI_CONFLICT' } } },
            'Failed',
        ),
    ).toBe('Reorder conflict')
    expect(adminErrorMessage(new Error('Transport failure'), 'Failed')).toBe('Transport failure')
    for (const value of [null, undefined, {}, { data: { message: 42 } }])
        expect(adminErrorMessage(value, 'Failed')).toBe('Failed')
})
