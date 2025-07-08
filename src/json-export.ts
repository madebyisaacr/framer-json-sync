import type { Collection, Field, CollectionItem, ArrayItem } from "framer-plugin"

import { isColorStyle } from "framer-plugin"

function downloadFile(file: File) {
    const filename = file.name
    const fileURL = URL.createObjectURL(file)

    const link = document.createElement("a")
    link.href = fileURL
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(fileURL)
}

type SupportedField = Exclude<Field, { type: "divider" | "unsupported" }>

function isFieldSupported(field: Field): field is SupportedField {
    switch (field.type) {
        case "image":
        case "file":
        case "collectionReference":
        case "formattedText":
        case "multiCollectionReference":
        case "enum":
        case "color":
        case "string":
        case "boolean":
        case "date":
        case "link":
        case "number":
        case "array":
            return true

        case "divider":
        case "unsupported":
            return false

        default:
            shouldBeNever(field)
            return false
    }
}

function getDataForField(field: Field, item: CollectionItem | ArrayItem) {
    const fieldData = item.fieldData[field.id]

    switch (fieldData.type) {
        case "image": {
            const image = fieldData.value

            if (!image) {
                return null
            }

            return {
                url: image.url,
                alt: image.altText || undefined,
            }
        }

        case "file": {
            return fieldData.value ? fieldData.value.url : ""
        }

        case "multiCollectionReference": {
            return fieldData.value
        }

        case "enum": {
            return fieldData.value
        }

        case "color": {
            return isColorStyle(fieldData.value) ? fieldData.value.light : fieldData.value
        }

        case "collectionReference":
        case "formattedText":
        case "string":
        case "boolean":
        case "date":
        case "link":
        case "number": {
            return fieldData.value ?? ""
        }

        case "array": {
            const value = []

            for (let i = 0; i < fieldData.value.length; i++) {
                const arrayItem: Record<string, any> = {}

                if (field.type === "array" && "fields" in field && field.fields) {
                    for (const arrayField of field.fields) {
                        arrayItem[arrayField.name] = getDataForField(arrayField, fieldData.value[i])
                    }
                }

                value.push(arrayItem)
            }

            return value
        }

        default: {
            return null
        }
    }
}

export function getDataForJSON(
    slugFieldName: string | null,
    fields: Field[],
    items: CollectionItem[]
): Record<string, any>[] {
    const supportedFields = fields.filter(isFieldSupported)
    const result: Record<string, any>[] = []

    // Add all the data rows.
    for (const item of items) {
        const row: Record<string, any> = {
            [slugFieldName ?? "Slug"]: item.slug,
        }

        // Add draft status if the item is a draft
        if (item.draft) {
            row[":draft"] = true
        }

        for (const field of supportedFields) {
            const data = getDataForField(field, item)
            row[field.name] = data
        }

        result.push(row)
    }

    return result
}

export async function convertCollectionToJSON(collection: Collection) {
    const [fields, items] = await Promise.all([collection.getFields(), collection.getItems()])

    const json = getDataForJSON(collection.slugFieldName, fields, items)

    return JSON.stringify(json, null, 2)
}

export async function exportCollectionAsJSON(collection: Collection, filename: string) {
    const json = await convertCollectionToJSON(collection)

    const file = new File([json], `${filename}.json`, {
        type: "application/json",
    })

    downloadFile(file)
}

/**
 * A utility function that does nothing but makes TypeScript check for the never type.
 *
 * For example, sometimes something that should never happen is expected to
 * happen, like during a rollback. To prevent unwanted crashers use
 * `shouldBeNever` instead of `assertNever`.
 */
export function shouldBeNever(_: never) {}
