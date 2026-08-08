import type { Collection } from "@framer/plugin"

import { framer } from "@framer/plugin"
import { useEffect, useRef, useState } from "react"
import {
    DRAFT_FIELD_ID,
    CREATED_AT_FIELD_ID,
    EDITED_AT_FIELD_ID,
    CREATED_AT_LABEL,
    EDITED_AT_LABEL,
    exportCollectionAsJSON,
    convertCollectionToJSON,
    getDataForJSON,
} from "../json-export"
import CollectionSelect from "./CollectionSelect"

const DRAFT_FIELD_LABEL = "Status"

const FIELD_TYPE_NAMES: Record<string, string> = {
    boolean: "Toggle",
    color: "Color",
    number: "Number",
    string: "Plain Text",
    formattedText: "Formatted Text",
    image: "Image",
    link: "Link",
    date: "Date",
    file: "File",
    enum: " Option", // The space prevents it from displaying as ⌥
    collectionReference: "Reference",
    multiCollectionReference: "Multi-Reference",
    array: "Gallery",
}

export default function Export({
    selectedCollection,
    collections,
    isLoading,
    selectCollection,
    goBack,
}: {
    selectedCollection: Collection | null
    collections: Collection[]
    isLoading: boolean
    selectCollection: (collectionId: string) => void
    goBack: () => void
}) {
    const optionsButtonRef = useRef<HTMLButtonElement>(null)
    const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (!selectedCollection) {
            setEnabledFields({})
            return
        }

        void Promise.all([selectedCollection.getFields(), selectedCollection.getItems()]).then(([fields, items]) => {
            const next: Record<string, boolean> = {}
            for (const field of fields) {
                if (field.type !== "divider" && field.type !== "unsupported") {
                    next[field.id] = true
                }
            }
            next[DRAFT_FIELD_ID] = items.some(item => item.draft)
            next[CREATED_AT_FIELD_ID] = true
            next[EDITED_AT_FIELD_ID] = true
            setEnabledFields(next)
        })
    }, [selectedCollection])

    const exportJSON = async () => {
        if (!selectedCollection) return

        await exportCollectionAsJSON(selectedCollection, selectedCollection.name, enabledFields)

        framer.notify("Downloaded JSON file", { variant: "success" })
    }

    const copyJSONtoClipboard = async () => {
        if (!selectedCollection) return

        const json = await convertCollectionToJSON(selectedCollection, enabledFields)

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(json)
            } else {
                // Fallback method for browsers that don't support clipboard.writeText
                const textArea = document.createElement("textarea")
                textArea.value = json
                document.body.appendChild(textArea)
                textArea.select()
                document.execCommand("copy")
                document.body.removeChild(textArea)
            }
            framer.notify("JSON copied to clipboard", { variant: "success" })
        } catch (error) {
            console.error("Failed to copy JSON:", error)
            framer.notify("Failed to copy JSON to clipboard", { variant: "error" })
        }
    }

    const onOptionsClick = async () => {
        if (!selectedCollection) return

        const rect = optionsButtonRef.current?.getBoundingClientRect()
        const fields = (await selectedCollection.getFields()).filter(
            field => field.type !== "divider" && field.type !== "unsupported"
        )

        const menuFields = [
            ...fields.slice(0, 1).map(field => ({ id: field.id, label: field.name, type: field.type })),
            { id: DRAFT_FIELD_ID, label: DRAFT_FIELD_LABEL, type: "boolean" },
            ...fields.slice(1).map(field => ({ id: field.id, label: field.name, type: field.type })),
            { id: CREATED_AT_FIELD_ID, label: CREATED_AT_LABEL, type: "date" },
            { id: EDITED_AT_FIELD_ID, label: EDITED_AT_LABEL, type: "date" },
        ]

        const allEnabled = menuFields.every(field => enabledFields[field.id] !== false)
        const allDisabled = menuFields.every(field => enabledFields[field.id] === false)

        console.log(menuFields.map(field => `${field.type} ${FIELD_TYPE_NAMES[field.type] ?? field.type}`))

        void framer.showContextMenu(
            [
                ...(!allEnabled
                    ? [
                          {
                              label: "Select All",
                              onAction: () => {
                                  setEnabledFields(Object.fromEntries(menuFields.map(field => [field.id, true])))
                              },
                          },
                      ]
                    : []),
                ...(!allDisabled
                    ? [
                          {
                              label: "Deselect All",
                              onAction: () => {
                                  setEnabledFields(Object.fromEntries(menuFields.map(field => [field.id, false])))
                              },
                          },
                      ]
                    : []),
                { type: "separator" },
                ...menuFields.map(field => ({
                    label: field.label,
                    secondaryLabel: FIELD_TYPE_NAMES[field.type] ?? field.type,
                    checked: enabledFields[field.id] !== false,
                    onAction: () => {
                        setEnabledFields(prev => ({
                            ...prev,
                            [field.id]: !prev[field.id],
                        }))
                    },
                })),
            ],
            {
                location: {
                    x: rect?.x ?? 0,
                    y: (rect?.y ?? 0) + (rect?.height ?? 0) + 4,
                },
                width: (rect?.width ?? 0) + 8,
            }
        )
    }

    return (
        <div className="export-collection">
            <div className="back-button" onClick={() => goBack()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
                    <g transform="translate(1.5 1)">
                        <path
                            d="M 3.5 0 L 0 4 L 3.5 7.5"
                            fill="transparent"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            strokeLinecap="round"
                        ></path>
                    </g>
                </svg>
                Back
            </div>

            <Preview collection={selectedCollection} enabledFields={enabledFields} />

            <div className="menu-buttons-container">
                <CollectionSelect
                    selectedCollection={selectedCollection}
                    collections={collections}
                    isLoading={isLoading}
                    selectCollection={selectCollection}
                />
                <button ref={optionsButtonRef} onClick={onOptionsClick} className="two-columns">
                    Fields
                </button>
                <button disabled={!selectedCollection} onClick={copyJSONtoClipboard}>
                    Copy
                </button>
                <button disabled={!selectedCollection} onClick={exportJSON} className="framer-button-primary">
                    Download
                </button>
            </div>
        </div>
    )
}

function Preview({
    collection,
    enabledFields,
}: {
    collection: Collection | null
    enabledFields: Record<string, boolean>
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLSpanElement>(null)

    const [previewJSON, setPreviewJSON] = useState<string>()

    useEffect(() => {
        const load = async () => {
            if (!collection) {
                setPreviewJSON("")
                return
            }

            const [fields, items] = await Promise.all([collection.getFields(), collection.getItems()])

            const previewItems = items.slice(0, 5)
            const jsonData = getDataForJSON(collection.slugFieldName, fields, previewItems, enabledFields)

            setPreviewJSON(JSON.stringify(jsonData, null, 2))
        }

        load()
    }, [collection, enabledFields])

    return (
        <div className="preview-container" ref={containerRef}>
            <div className="preview-container-inner">
                <span className="preview-container-json" ref={contentRef}>
                    {previewJSON}
                </span>
            </div>

            <div className="preview-container-gradient" />
            <div className="preview-container-border" />
        </div>
    )
}
