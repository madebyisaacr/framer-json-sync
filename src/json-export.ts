import type { Collection, Field, CollectionItem } from "framer-plugin"

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
            return true

        case "divider":
        case "unsupported":
            return false

        default:
            shouldBeNever(field)
            return false
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

        for (const field of supportedFields) {
            const fieldData = item.fieldData[field.id]

            switch (fieldData.type) {
                case "image": {
                    const image = fieldData.value

                    if (!image) {
                        row[field.name] = null
                        continue
                    }

                    row[field.name] = {
                        url: image.url,
                        alt: image.altText || undefined,
                    }
                    continue
                }

                case "file": {
                    row[field.name] = fieldData.value ? fieldData.value.url : ""
                    continue
                }

                case "multiCollectionReference": {
                    row[field.name] = fieldData.value
                    continue
                }

                case "enum": {
                    row[field.name] = fieldData.value
                    continue
                }

                case "color": {
                    row[field.name] = isColorStyle(fieldData.value) ? fieldData.value.light : fieldData.value
                    continue
                }

                case "collectionReference":
                case "formattedText":
                case "string":
                case "boolean":
                case "date":
                case "link":
                case "number": {
                    row[field.name] = fieldData.value ?? ""
                    continue
                }

                default: {
                    shouldBeNever(fieldData)
                }
            }
        }

        result.push(row)
    }

    return result
}

export async function convertCollectionToJSON(collection: Collection) {
    const fields = await collection.getFields()
    const items = await collection.getItems()

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
