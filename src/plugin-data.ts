const MAX_BYTES_PER_KEY = 2 * 1024
const MAX_TOTAL_BYTES = 4 * 1024

type PluginDataStore = {
    getPluginData(key: string): Promise<string | null>
    setPluginData(key: string, value: string | null): Promise<void>
}

function getOverflowKey(key: string) {
    return `${key}:1`
}

function getByteLength(value: string) {
    return new TextEncoder().encode(value).length
}

/** Split `value` so the first chunk is at most `maxBytes` UTF-8 bytes. */
function splitByMaxBytes(value: string, maxBytes: number): [string, string] {
    const bytes = new TextEncoder().encode(value)
    if (bytes.length <= maxBytes) return [value, ""]

    let end = maxBytes
    // Avoid splitting in the middle of a multi-byte UTF-8 sequence.
    while (end > 0 && (bytes[end]! & 0xc0) === 0x80) {
        end--
    }

    const decoder = new TextDecoder()
    return [decoder.decode(bytes.subarray(0, end)), decoder.decode(bytes.subarray(end))]
}

/**
 * Reads a string stored across one or two plugin data keys.
 * Returns `null` when neither key has a value.
 */
export async function getPluginDataString(store: PluginDataStore, key: string): Promise<string | null> {
    const [part1, part2] = await Promise.all([store.getPluginData(key), store.getPluginData(getOverflowKey(key))])

    if (part1 === null && part2 === null) return null
    return (part1 ?? "") + (part2 ?? "")
}

/**
 * Writes a string to plugin data, splitting across a second key when over 2KB
 * so values can use up to the collection's 4KB total plugin data budget.
 * Pass `null` to clear both keys.
 */
export async function setPluginDataString(store: PluginDataStore, key: string, value: string | null): Promise<void> {
    const overflowKey = getOverflowKey(key)

    if (value === null) {
        await Promise.all([store.setPluginData(key, null), store.setPluginData(overflowKey, null)])
        return
    }

    if (getByteLength(value) > MAX_TOTAL_BYTES) {
        throw new Error(`Plugin data exceeds the ${MAX_TOTAL_BYTES} byte limit`)
    }

    const [part1, part2] = splitByMaxBytes(value, MAX_BYTES_PER_KEY)

    await Promise.all([store.setPluginData(key, part1), store.setPluginData(overflowKey, part2 || null)])
}
