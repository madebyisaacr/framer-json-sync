import type { Collection } from "framer-plugin"
import type { ImportResult } from "./json-import"

import "./App.css"
import { useState, useEffect, useCallback, useRef, ChangeEvent, useMemo } from "react"
import { framer, useIsAllowedTo } from "framer-plugin"
import Export from "./components/Export"
import CollectionSelect from "./components/CollectionSelect"
import ManageConflicts from "./components/ManageConflicts"
import { processRecords, parseJSON, importJSON, ImportError } from "./json-import"

const GITHUB_URL = "https://github.com/madebyisaacr/framer-json-sync"

export function App({ collection }: { collection: Collection | null }) {
    const [exportMenuOpen, setExportMenuOpen] = useState(collection?.readonly ?? false)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const isAllowedToAddItems = useIsAllowedTo("Collection.addItems")

    const [isLoading, setIsLoading] = useState(true)
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(collection)

    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)

    const initialCollection = useMemo(() => collection, [])
    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    const isReadOnly = selectedCollection?.readonly ?? false
    const canDropFile = selectedCollection && !isReadOnly && !exportMenuOpen && isAllowedToAddItems

    useEffect(() => {
        if (itemsWithConflict.length === 0) {
            framer.showUI({
                width: exportMenuOpen ? 360 : 260,
                height: exportMenuOpen ? 400 : 330,
                resizable: false,
            })
        } else {
            framer.showUI({
                width: 260,
                height: 165,
                resizable: false,
            })
        }
    }, [exportMenuOpen, itemsWithConflict])

    useEffect(() => {
        Promise.all([framer.getCollections(), framer.getActiveCollection()]).then(([collections, activeCollection]) => {
            setIsLoading(false)
            setCollections(collections)
            setSelectedCollection(activeCollection)
        })
    }, [])

    useEffect(() => {
        if (selectedCollection && initialCollection) {
            selectedCollection.setAsActive()
        }
    }, [selectedCollection])

    const importItems = useCallback(
        async (result: ImportResult) => {
            if (!selectedCollection) return

            await framer.hideUI()
            await importJSON(selectedCollection, result)
        },
        [selectedCollection]
    )

    useEffect(() => {
        framer.setMenu([
            {
                label: "View Code on GitHub",
                onAction: () => {
                    try {
                        window.open(GITHUB_URL, "_blank")
                    } catch (error) {
                        console.error(error)
                        framer.notify(`Failed to open link: ${GITHUB_URL}`, { variant: "error" })
                    }
                },
            },
        ])
    }, [])

    const processAndImport = useCallback(
        async (json: string) => {
            try {
                if (!checkPermissions()) return
                if (!selectedCollection) return

                const jsonRecords = await parseJSON(json)
                if (jsonRecords.length === 0) {
                    throw new Error("No records found in JSON")
                }

                const result = await processRecords(selectedCollection, jsonRecords)
                setResult(result)

                if (result.items.some(item => item.action === "conflict")) {
                    return
                }

                await importItems(result)
            } catch (error) {
                console.error(error)

                if (error instanceof ImportError) {
                    framer.notify(error.message, {
                        variant: "error",
                    })
                    return
                }

                framer.notify("Error processing JSON file. Check console for details.", {
                    variant: "error",
                })
            }
        },
        [selectedCollection, importItems]
    )

    useEffect(() => {
        if (!form.current) return
        if (!canDropFile) return

        const handleDragOver = (event: DragEvent) => {
            event.preventDefault()
            setIsDragging(true)
        }

        const handleDragLeave = (event: DragEvent) => {
            if (!event.relatedTarget) {
                setIsDragging(false)
            }
        }

        const handleDrop = async (event: DragEvent) => {
            event.preventDefault()
            setIsDragging(false)

            const file = event.dataTransfer?.files[0]
            if (!file || !file.name.endsWith(".json")) return

            const input = document.getElementById("file-input") as HTMLInputElement
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)
            input.files = dataTransfer.files
            form.current?.requestSubmit()
        }

        form.current?.addEventListener("dragover", handleDragOver)
        form.current?.addEventListener("dragleave", handleDragLeave)
        form.current?.addEventListener("drop", handleDrop)

        return () => {
            form.current?.removeEventListener("dragover", handleDragOver)
            form.current?.removeEventListener("dragleave", handleDragLeave)
            form.current?.removeEventListener("drop", handleDrop)
        }
    }, [canDropFile])

    useEffect(() => {
        const handlePaste = async (event: ClipboardEvent) => {
            if (!checkPermissions()) return

            if (!canDropFile) return
            if (!event.clipboardData) return

            try {
                const json = event.clipboardData.getData("text/plain")
                if (!json) return

                await processAndImport(json)
            } catch (error) {
                console.error("Error accessing clipboard data:", error)
                framer.notify("Unable to access clipboard content", {
                    variant: "error",
                })
            }
        }

        window.addEventListener("paste", handlePaste)

        return () => {
            window.removeEventListener("paste", handlePaste)
        }
    }, [processAndImport, canDropFile])

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()

            const formData = new FormData(form.current!)
            const fileValue = formData.get("file")

            if (!fileValue || typeof fileValue === "string") return

            const file = fileValue

            const json = await file.text()

            await processAndImport(json)
        },
        [processAndImport]
    )

    const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        if (!event.currentTarget.files?.[0]) return
        if (inputOpenedFromImportButton.current) {
            form.current?.requestSubmit()
        }
    }, [])

    const onFileUploadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!checkPermissions()) return

        event.preventDefault()
        inputOpenedFromImportButton.current = true

        const input = document.getElementById("file-input") as HTMLInputElement
        input.click()
    }

    const selectCollection = (event: ChangeEvent<HTMLSelectElement>) => {
        const collection = collections.find(collection => collection.id === event.currentTarget.value)
        if (!collection) return

        setSelectedCollection(collection)
    }

    if (result && itemsWithConflict.length > 0) {
        return (
            <ManageConflicts
                records={itemsWithConflict}
                onAllConflictsResolved={resolvedItems => {
                    const updatedItems = result.items.map(item => {
                        const resolvedItem = resolvedItems.find(resolved => resolved.slug === item.slug)
                        return resolvedItem || item
                    })
                    importItems({ ...result, items: updatedItems })
                }}
            />
        )
    }

    return (
        <form ref={form} className="import-collection" onSubmit={handleSubmit}>
            {canDropFile && (
                <input
                    id="file-input"
                    type="file"
                    name="file"
                    className="file-input"
                    accept=".json"
                    required
                    onChange={handleFileChange}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        cursor: "pointer",
                    }}
                />
            )}

            {isDragging ? (
                <div className="dropzone dragging">{isDragging && <p>Drop JSON file to import</p>}</div>
            ) : exportMenuOpen ? (
                <Export
                    selectedCollection={selectedCollection}
                    collections={collections}
                    isLoading={isLoading}
                    selectCollection={selectCollection}
                    goBack={() => setExportMenuOpen(false)}
                />
            ) : (
                <div className="main-menu">
                    <div className="intro">
                        <div className="logo">
                            <ImportIcon />
                        </div>
                        <div className="content">
                            <h2>JSON Sync</h2>
                            <p>Import and export CMS content using JSON files.</p>
                        </div>
                    </div>
                    <div className="menu-buttons-container">
                        <CollectionSelect
                            selectedCollection={selectedCollection}
                            collections={collections}
                            isLoading={isLoading}
                            selectCollection={selectCollection}
                        />
                        <button
                            onClick={onFileUploadClick}
                            disabled={!selectedCollection || isReadOnly || collections.length === 0}
                        >
                            Import
                        </button>
                        <button
                            className="framer-button-primary"
                            onClick={() => setExportMenuOpen(true)}
                            disabled={collections.length === 0}
                        >
                            Export
                        </button>
                    </div>
                </div>
            )}
        </form>
    )
}

function ImportIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none">
            <path
                d="M 9 1.4 C 12.59 1.4 15.5 2.799 15.5 4.525 C 15.5 6.251 12.59 7.65 9 7.65 C 5.41 7.65 2.5 6.251 2.5 4.525 C 2.5 2.799 5.41 1.4 9 1.4 Z M 15.5 8.9 C 15.5 10.626 12.59 12.025 9 12.025 C 5.41 12.025 2.5 10.626 2.5 8.9 C 2.5 8.037 2.5 6.4 2.5 6.4 C 2.5 8.126 5.41 9.525 9 9.525 C 12.59 9.525 15.5 8.126 15.5 6.4 C 15.5 6.4 15.5 8.037 15.5 8.9 Z M 15.5 13.275 C 15.5 15.001 12.59 16.4 9 16.4 C 5.41 16.4 2.5 15.001 2.5 13.275 C 2.5 12.412 2.5 10.775 2.5 10.775 C 2.5 12.501 5.41 13.9 9 13.9 C 12.59 13.9 15.5 12.501 15.5 10.775 C 15.5 10.775 15.5 12.412 15.5 13.275 Z"
                fill="var(--framer-color-tint)"
            ></path>
        </svg>
    )
}

function checkPermissions() {
    const isAllowedToAddItems = framer.isAllowedTo("Collection.addItems")

    if (!isAllowedToAddItems) {
        framer.notify("You do not have permissions to edit CMS items", { variant: "error" })
        return false
    }

    return true
}
