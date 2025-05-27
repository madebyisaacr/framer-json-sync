import type { Collection } from "framer-plugin"

import { framer } from "framer-plugin"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { exportCollectionAsJSON, convertCollectionToJSON, getDataForJSON } from "../json-export"
import CollectionSelect from "./CollectionSelect"

export default function ExportUI({
    selectedCollection,
    collections,
    isLoading,
    selectCollection,
    goBack,
}: {
    selectedCollection: Collection
    collections: Collection[]
    isLoading: boolean
    selectCollection: (event: ChangeEvent<HTMLSelectElement>) => void
    goBack: () => void
}) {
    const isReadOnly = selectedCollection?.readonly ?? false

    const exportJSON = async () => {
        if (!selectedCollection) return

        await exportCollectionAsJSON(selectedCollection, selectedCollection.name)

        framer.notify("Downloaded JSON file", { variant: "success" })
    }

    const copyJSONtoClipboard = async () => {
        if (!selectedCollection) return

        const json = await convertCollectionToJSON(selectedCollection)

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

    return (
        <div className="export-collection">
            {!isReadOnly && (
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
            )}

            <Preview collection={selectedCollection} />

            <div className="menu-buttons-container">
                <CollectionSelect
                    selectedCollection={selectedCollection}
                    collections={collections}
                    isLoading={isLoading}
                    selectCollection={selectCollection}
                />
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

function Preview({ collection }: { collection: Collection | null }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLSpanElement>(null)

    const [previewJSON, setPreviewJSON] = useState<string>()

    useEffect(() => {
        const load = async () => {
            if (!collection) {
                setPreviewJSON("")
                return
            }

            const fields = await collection.getFields()
            const items = await collection.getItems()

            const previewItems = items.slice(0, 5)
            const jsonData = getDataForJSON(collection.slugFieldName, fields, previewItems)

            setPreviewJSON(JSON.stringify(jsonData, null, 2))
        }

        load()
    }, [collection])

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
