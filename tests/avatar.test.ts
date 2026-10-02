import { expect, test } from 'bun:test'

import { parseAvatarSize } from '../server/utils/avatar'

test('avatar size accepts bounded integers only', () => {
    expect(parseAvatarSize(undefined)).toBe(2048)
    expect(parseAvatarSize('512')).toBe(512)
    expect(parseAvatarSize('0')).toBeNull()
    expect(parseAvatarSize('2049')).toBeNull()
    expect(parseAvatarSize('512px')).toBeNull()
})
