import type { Collection } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect, useRef, useState } from "react"
import { exportCollectionAsJSON, convertCollectionToJSON, getDataForJSON } from "../json-export"

export default function ExportUI({
    collection,
    exportOnly,
    goBack,
}: {
    collection: Collection
    exportOnly: boolean
    goBack: () => void
}) {
    const exportJSON = async () => {
        if (!collection) return

        await exportCollectionAsJSON(collection, collection.name)

        framer.notify("Downloaded JSON file", { variant: "success" })
    }

    const copyJSONtoClipboard = async () => {
        if (!collection) return

        const json = await convertCollectionToJSON(collection)

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
            {!exportOnly && (
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

            {collection && <Preview collection={collection} />}

            <div className="menu-buttons-container">
                <button disabled={!collection} onClick={copyJSONtoClipboard}>
                    Copy
                </button>
                <button disabled={!collection} onClick={exportJSON} className="framer-button-primary">
                    Download
                </button>
            </div>
        </div>
    )
}

function Preview({ collection }: { collection: Collection }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLSpanElement>(null)

    const [previewJSON, setPreviewJSON] = useState<string>()
    const [showGradient, setShowGradient] = useState(false)

    useEffect(() => {
        const load = async () => {
            if (!collection) return

            const fields = await collection.getFields()
            const items = await collection.getItems()

            const previewItems = items.slice(0, 5)
            const jsonData = getDataForJSON(collection.slugFieldName, fields, previewItems)

            setPreviewJSON(JSON.stringify(jsonData, null, 2))
        }

        const resize = () => {
            if (!containerRef.current || !contentRef.current) return

            const containerBounds = containerRef.current.getBoundingClientRect()
            const contentBounds = contentRef.current.getBoundingClientRect()

            setShowGradient(containerBounds.height - 25 < contentBounds.height)
        }

        window.addEventListener("resize", resize)

        load()
        resize()

        return () => {
            window.removeEventListener("resize", resize)
        }
    }, [collection])

    return (
        <div className="preview-container" ref={containerRef}>
            <div className="preview-container-inner">
                <span className="preview-container-json" ref={contentRef}>
                    {previewJSON}
                </span>
            </div>

            {showGradient && <div className="preview-container-gradient" />}

            <div className="preview-container-border" />
        </div>
    )
}
