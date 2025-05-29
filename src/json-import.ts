import {
    Collection,
    Field,
    CollectionItem,
    CollectionItemInput,
    framer,
    FieldDataInput,
    FieldDataEntryInput,
} from "framer-plugin"

type JSONRecord = Record<string, string>

export type ImportResultItem = CollectionItemInput & {
    action: "add" | "conflict" | "onConflictUpdate" | "onConflictSkip"
}

export type ImportResult = {
    warnings: {
        missingSlugCount: number
        doubleSlugCount: number
        skippedValueCount: number
        skippedValueKeys: Set<string>
    }
    items: ImportResultItem[]
}

/**
 * Parses a string of JSON data. Does not do any type casting, because we want to
 * apply that based on the fields the data will go into, not the data itself.
 *
 * @param data JSON data.
 * @returns Array of parsed records
 */
export async function parseJSON(data: string): Promise<JSONRecord[]> {
    let records: JSONRecord[] = []
    let error: unknown

    try {
        records = JSON.parse(data)
    } catch (err) {
        error = err
    }

    if (error) {
        throw error
    }

    return records
}

/** Error when importing fails, internal to `RecordImporter` */
export class ImportError extends Error {
    /**
     * @param variant Notification variant to show the user
     * @param message Message to show the user
     */
    constructor(readonly variant?: "error" | "warning", message?: string) {
        super(message)
    }
}

/** Used to indicated a value conversion failed, used by `RecordImporter` and `setValueForVariable` */
class ConversionError extends Error {}

const collator = new Intl.Collator("en", { sensitivity: "base" })
const BOOLEAN_TRUTHY_VALUES = /1|y(?:es)?|true/iu

function getFieldDataEntryInputForField(
    field: Field,
    value: string | null,
    allItemIdBySlug: Map<string, Map<string, string>>
): FieldDataEntryInput | ConversionError {
    switch (field.type) {
        case "string":
        case "formattedText":
            return { type: field.type, value: value ?? "" }

        case "color":
        case "link":
        case "file":
            return { type: field.type, value: value ? value.trim() : null }

        case "image":
            if (typeof value === "string") {
                // Check if it's an HTML img tag
                const imgMatch = value.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/i)
                if (imgMatch) {
                    return {
                        type: field.type,
                        value: imgMatch[1],
                        alt: imgMatch[2] || undefined,
                    }
                }
                return { type: field.type, value }
            } else if (typeof value === "object" && value) {
                const imageValue = value as { url?: string; alt?: string; altText?: string }
                return {
                    type: field.type,
                    value: imageValue.url || null,
                    alt: imageValue.alt || imageValue.altText || undefined,
                }
            } else {
                return { type: field.type, value: null }
            }

        case "number": {
            const number = value === undefined ? 0 : Number(value)
            if (Number.isNaN(number)) {
                return new ConversionError(`Invalid value for field “${field.name}” expected a number`)
            }
            return { type: "number", value: number ?? 0 }
        }

        case "boolean": {
            return { type: "boolean", value: value ? BOOLEAN_TRUTHY_VALUES.test(value) : false }
        }

        case "date": {
            if (value === null) {
                return { type: "date", value: null }
            }
            const date = new Date(value)
            if (!isValidDate(date)) {
                return new ConversionError(`Invalid value for field “${field.name}” expected a valid date`)
            }
            const isoDate = date.toISOString().split("T")[0]
            return { type: "date", value: new Date(isoDate).toJSON() }
        }

        case "enum": {
            if (value === null) {
                if (field.cases.length === 0) {
                    return new ConversionError(`Enum “${field.name}” has no cases`)
                }
                return { type: "enum", value: field.cases[0].id }
            }
            const matchingCase = field.cases.find(
                enumCase => collator.compare(enumCase.name, value) === 0 || enumCase.id === value
            )
            if (!matchingCase) {
                return new ConversionError(`Invalid case “${value}” for enum “${field.name}”`)
            }
            return { type: "enum", value: matchingCase.id }
        }

        case "collectionReference": {
            if (value === null) {
                return { type: "collectionReference", value: null }
            }

            const referencedSlug = value.trim()
            const referencedId = allItemIdBySlug.get(field.collectionId)?.get(referencedSlug)
            if (!referencedId) {
                return new ConversionError(`Invalid Collection reference “${value}”`)
            }

            return { type: "collectionReference", value: referencedId }
        }

        case "multiCollectionReference": {
            if (value === null) {
                return { type: "multiCollectionReference", value: [] }
            }
            const referencedSlugs = Array.isArray(value)
                ? value.filter(slug => slug && typeof slug === "string")
                : typeof value === "string"
                ? value.split(",").map(slug => slug.trim())
                : []
            const referencedIds: string[] = []

            for (const slug of referencedSlugs) {
                const referencedId = allItemIdBySlug.get(field.collectionId)?.get(slug)
                if (!referencedId) {
                    return new ConversionError(`Invalid Collection reference “${slug}”`)
                }
                referencedIds.push(referencedId)
            }

            return { type: "multiCollectionReference", value: referencedIds }
        }

        case "divider":
        case "unsupported":
            return new ConversionError(`Unsupported field type “${field.type}”`)
    }
}

function getFirstMatchingIndex(values: string[], name: string | undefined) {
    if (!name) {
        return -1
    }

    for (const [index, value] of values.entries()) {
        if (collator.compare(value, name) === 0) {
            return index
        }
    }

    return -1
}

/** Importer for "records": string based values with named keys */
export async function processRecords(collection: Collection, records: JSONRecord[]) {
    if (!collection.slugFieldName) {
        throw new ImportError("error", "Import failed. No slug field was found in your CMS Collection.")
    }

    const existingItems = await collection.getItems()

    const result: ImportResult = {
        warnings: {
            missingSlugCount: 0,
            doubleSlugCount: 0,
            skippedValueCount: 0,
            skippedValueKeys: new Set<string>(),
        },
        items: [],
    }

    const fields = await collection.getFields()
    const allItemIdBySlug = new Map<string, Map<string, string>>()

    const allJSONKeys = new Set<string>()

    for (const record of records) {
        for (const key of Object.keys(record)) {
            allJSONKeys.add(key)
        }
    }

    const fieldsToImport = fields.filter(field => allJSONKeys.has(field.name))

    // Find the slug field key
    let slugFieldKey = ""

    if (allJSONKeys.has(collection.slugFieldName)) {
        slugFieldKey = collection.slugFieldName
    } else {
        // Find the based on field
        const basedOnField = fields.find(field => field.id === collection.slugFieldBasedOn)
        if (basedOnField && allJSONKeys.has(basedOnField.name)) {
            slugFieldKey = basedOnField.name
        }
    }

    if (!slugFieldKey) {
        throw new ImportError("error", `Import failed. Ensure your JSON has a key named “${collection.slugFieldName}”.`)
    }

    for (const field of fields) {
        if (field.type === "collectionReference" || field.type === "multiCollectionReference") {
            const collectionIdBySlug = allItemIdBySlug.get(field.collectionId) ?? new Map<string, string>()

            const collection = await framer.getCollection(field.collectionId)
            if (!collection) {
                throw new ImportError(
                    "error",
                    `Import failed. “${field.name}” references a Collection that doesn’t exist.`
                )
            }

            const items = await collection.getItems()
            for (const item of items) {
                collectionIdBySlug.set(item.slug, item.id)
            }

            allItemIdBySlug.set(field.collectionId, collectionIdBySlug)
        }
    }

    const newSlugValues = new Set<string>()
    const existingItemsBySlug = new Map<string, CollectionItem>()
    for (const item of existingItems) {
        existingItemsBySlug.set(item.slug, item)
    }

    for (const record of records) {
        let slug: string | undefined = record[slugFieldKey] ? slugify(record[slugFieldKey]) : undefined

        if (!slug) {
            result.warnings.missingSlugCount++
            continue
        } else if (newSlugValues.has(slug)) {
            result.warnings.doubleSlugCount++
            continue
        }

        const fieldData: FieldDataInput = {}
        for (const field of fieldsToImport) {
            const value = record[field.name]
            const fieldDataEntry = getFieldDataEntryInputForField(field, value, allItemIdBySlug)

            if (fieldDataEntry instanceof ConversionError) {
                result.warnings.skippedValueCount++
                result.warnings.skippedValueKeys.add(field.name)
                continue
            }

            if (fieldDataEntry !== undefined) {
                fieldData[field.id] = fieldDataEntry
            }
        }

        const item: ImportResultItem = {
            id: existingItemsBySlug.get(slug)?.id,
            slug,
            fieldData,
            action: existingItemsBySlug.get(slug) ? "conflict" : "add",
        }

        if (item.action === "add") {
            newSlugValues.add(slug)
        }

        result.items.push(item)
    }

    return result
}

export async function importJSON(collection: Collection, result: ImportResult) {
    const totalItems = result.items.length
    const totalAdded = result.items.filter(item => item.action === "add").length
    const totalUpdated = result.items.filter(item => item.action === "onConflictUpdate").length
    const totalSkipped = result.items.filter(item => item.action === "onConflictSkip").length
    if (totalItems !== totalAdded + totalUpdated + totalSkipped) {
        throw new Error("Total items mismatch")
    }

    await collection.addItems(
        result.items
            .filter(item => item.action !== "onConflictSkip")
            .map(item =>
                item.action === "add"
                    ? {
                          slug: item.slug!,
                          fieldData: item.fieldData,
                      }
                    : {
                          id: item.id!,
                          fieldData: item.fieldData,
                      }
            )
    )

    const messages: string[] = []
    if (totalAdded > 0) {
        messages.push(`Added ${totalAdded} ${totalAdded === 1 ? "item" : "items"}`)
    }
    if (totalUpdated > 0) {
        messages.push(`Updated ${totalUpdated} ${totalUpdated === 1 ? "item" : "items"}`)
    }
    if (totalSkipped > 0) {
        messages.push(`Skipped ${totalSkipped} ${totalSkipped === 1 ? "item" : "items"}`)
    }

    if (result.warnings.missingSlugCount > 0) {
        messages.push(
            `Skipped ${result.warnings.missingSlugCount} ${
                result.warnings.missingSlugCount === 1 ? "item" : "items"
            } because of missing slug field`
        )
    }
    if (result.warnings.doubleSlugCount > 0) {
        messages.push(
            `Skipped ${result.warnings.doubleSlugCount} ${
                result.warnings.doubleSlugCount === 1 ? "item" : "items"
            } because of duplicate slugs`
        )
    }

    const { skippedValueCount, skippedValueKeys } = result.warnings
    if (skippedValueCount > 0) {
        messages.push(
            `Skipped ${skippedValueCount} ${skippedValueCount === 1 ? "value" : "values"} for ${
                skippedValueKeys.size
            } ${skippedValueKeys.size === 1 ? "field" : "fields"} (${summary([...skippedValueKeys], 3)})`
        )
    }

    const finalMessage = messages.join(". ")
    await framer.closePlugin(
        messages.length > 1 ? finalMessage + "." : finalMessage || "Successfully imported Collection"
    )
}

function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.getTime())
}

/** Helper to show a summary of items, truncating after `max` */
function summary(items: string[], max: number) {
    const summaryFormatter = new Intl.ListFormat("en", { style: "long", type: "conjunction" })

    if (items.length === 0) {
        return "none"
    }
    // Go one past the max, because we'll add a sentinel anyway
    if (items.length > max + 1) {
        items = items.slice(0, max).concat([`${items.length - max} more`])
    }
    return summaryFormatter.format(items)
}

// Match everything except for letters, numbers and parentheses.
const nonSlugCharactersRegExp = /[^\p{Letter}\p{Number}()]+/gu
// Match leading/trailing dashes, for trimming purposes.
const trimSlugRegExp = /^-+|-+$/gu

/**
 * Takes a freeform string and removes all characters except letters, numbers,
 * and parentheses. Also makes it lower case, and separates words by dashes.
 * This makes the value URL safe.
 */
export function slugify(value: string): string {
    return value.toLowerCase().replace(nonSlugCharactersRegExp, "-").replace(trimSlugRegExp, "")
}
