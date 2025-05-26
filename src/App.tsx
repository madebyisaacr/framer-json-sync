import type { Collection } from "framer-plugin"

import "./App.css"
import { useState, useEffect } from "react"
import { framer } from "framer-plugin"
import MainMenu from "./components/MainMenu"
import ImportUI from "./components/ImportUI"
import ExportUI from "./components/ExportUI"

export function App({ collection, exportOnly }: { collection: Collection; exportOnly: boolean }) {
    const [type, setType] = useState<"import" | "export" | null>(exportOnly ? "export" : null)

    useEffect(() => {
        framer.showUI({
            width: 260,
            height: 330,
            resizable: false,
        })
    }, [])

    return type === "import" ? (
        <ImportUI collection={collection} />
    ) : type === "export" ? (
        <ExportUI collection={collection} />
    ) : (
        <MainMenu setType={setType} />
    )
}
