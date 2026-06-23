import type { Collection } from "@framer/plugin"
import type { ImportResult } from "./json-import"

import "./App.css"
import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from "react"
import { framer, useIsAllowedTo } from "@framer/plugin"
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
        if (selectedCollection) {
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

    const selectCollection = (collectionId: string) => {
        const collection = collections.find(collection => collection.id === collectionId)
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
                            <h2>JSON Import & Export</h2>
                            <p>Update or download CMS content with JSON files.</p>
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
        <svg
            role="presentation"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="1.5"
                d="M1.5 8.75v-5.5C1.5 1.869 3.515.75 6 .75s4.5 1.119 4.5 2.5v5.5m0 0c0 1.381-2.015 2.5-4.5 2.5s-4.5-1.119-4.5-2.5"
            ></path>
            <path
                fill="none"
                stroke="currentColor"
                d="M10.25 3.25c0 1.105-1.903 2-4.25 2s-4.25-.895-4.25-2M10.25 6c0 1.105-1.903 2-4.25 2s-4.25-.895-4.25-2"
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
