import "framer-plugin/framer.css"

import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./App.tsx"
import { framer } from "framer-plugin"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const collection = await framer.getActiveCollection()

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App collection={collection} exportOnly={collection?.readonly ?? false} />
    </React.StrictMode>
)
