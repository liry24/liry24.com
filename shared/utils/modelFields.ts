import type { describeModel } from '@litijs/model'

import type { ComposerField } from '../types/adminComposer'

export function modelFields(model: ReturnType<typeof describeModel>): ComposerField[] {
    return Object.entries(model.fields).map(([key, definition]) => {
        const schema = definition.schema as Record<string, unknown>
        const items = schema.items as Record<string, unknown> | undefined
        const kind = definition.reference
            ? 'relation'
            : schema['x-vitehub-blob']
              ? 'image'
              : items?.['x-vitehub-blob']
                ? 'images'
                : Array.isArray(schema.enum)
                  ? 'select'
                  : definition.input === 'date'
                    ? 'datetime'
                    : schema.type === 'array' && items?.type === 'string'
                      ? 'array'
                      : schema.type === 'array' || schema.type === 'object'
                        ? 'json'
                        : definition.input === 'textarea'
                          ? 'textarea'
                          : schema.format === 'uri'
                            ? 'url'
                            : schema.type === 'integer' || schema.type === 'number'
                              ? 'number'
                              : schema.type === 'boolean'
                                ? 'boolean'
                                : 'text'
        return {
            key,
            label:
                definition.label ??
                key
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/^./, (letter) => letter.toUpperCase()),
            kind,
            hasDefault: Object.hasOwn(schema, 'default'),
            values: Array.isArray(schema.enum) ? schema.enum.map(String) : undefined,
        }
    })
}
