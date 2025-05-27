import type { Collection } from "framer-plugin"

import { framer } from "framer-plugin"
import { useEffect } from "react"
import Heading from "./Heading"
import { exportCollectionAsJSON, convertCollectionToJSON } from "../json-export"

export default function ExportUI({ collection }: { collection: Collection }) {
    useEffect(() => {
        framer.showUI({
            width: 340,
            height: 370,
            resizable: false,
        })
    }, [])

    const exportJSON = async () => {
        if (!collection) return

        exportCollectionAsJSON(collection, collection.name)
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
            <div className="preview-container">
                <div className={`preview-container-table ${collection ? "visible" : ""}`}>
                    {/* {collection && <PreviewTable collection={collection} />} */}
                </div>
            </div>

            <div className="menu-buttons-container">
                <button disabled={!collection} onClick={copyJSONtoClipboard}>
                    Copy
                </button>
                <button disabled={!collection} onClick={exportJSON} className="framer-button-primary">
                    Export
                </button>
            </div>
        </div>
    )
}
