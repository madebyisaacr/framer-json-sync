import type { Collection } from "framer-plugin"
import type { ImportResult, ImportResultItem } from "./json"

import "./App.css"
import { useState, useEffect, useCallback, useRef, ChangeEvent, useMemo } from "react"
import { framer } from "framer-plugin"
import ExportUI from "./components/ExportUI"
import Heading from "./components/Heading"
import { processRecords, parseJSON, importJSON, ImportError } from "./json"

export function App({ collection, exportOnly }: { collection: Collection; exportOnly: boolean }) {
    const [type, setType] = useState<"import" | "export" | null>(exportOnly ? "export" : null)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const [isLoading, setIsLoading] = useState(true)
    const [collections, setCollections] = useState<Collection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)

    const form = useRef<HTMLFormElement>(null)
    const inputOpenedFromImportButton = useRef(false)

    const itemsWithConflict = useMemo(() => result?.items.filter(item => item.action === "conflict") ?? [], [result])

    useEffect(() => {
        framer.showUI({
            width: 260,
            height: 330,
            resizable: false,
        })

        Promise.all([framer.getCollections(), framer.getActiveCollection()]).then(([collections, activeCollection]) => {
            setIsLoading(false)
            setCollections(collections)
            setSelectedCollection(activeCollection)
        })
    }, [])

    useEffect(() => {
        if (itemsWithConflict.length === 0) {
            return
        }

        framer.showUI({
            width: 260,
            height: 165,
            resizable: false,
        })
    }, [itemsWithConflict])

    const importItems = useCallback(
        async (result: ImportResult) => {
            await framer.hideUI()
            await importJSON(collection, result)
        },
        [collection]
    )

    const processAndImport = useCallback(
        async (json: string) => {
            try {
                const jsonRecords = await parseJSON(json)
                if (jsonRecords.length === 0) {
                    throw new Error("No records found in JSON")
                }

                const result = await processRecords(collection, jsonRecords)
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
        [collection, importItems]
    )

    useEffect(() => {
        if (!form.current) return

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
    }, [])

    useEffect(() => {
        const handlePaste = async (event: ClipboardEvent) => {
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
    }, [processAndImport])

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
            {!exportOnly && (
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
            ) : type === "import" ? (
                <>
                    <Heading title="Upload JSON">
                        Make sure your collection fields in Framer match the names of the keys in your JSON file.
                    </Heading>
                </>
            ) : type === "export" ? (
                <ExportUI collection={collection} />
            ) : (
                <div className="main-menu">
                    <Heading title="JSON Sync">Import and export CMS content using JSON files.</Heading>
                    <div className="menu-buttons-container">
                        <button onClick={onFileUploadClick}>Import</button>
                        <button className="framer-button-primary" onClick={() => setType("export")}>
                            Export
                        </button>
                    </div>
                </div>
            )}
        </form>
    )
}

interface ManageConflictsProps {
    records: ImportResultItem[]
    onAllConflictsResolved: (items: ImportResultItem[]) => void
}

function ManageConflicts({ records, onAllConflictsResolved }: ManageConflictsProps) {
    const [recordsIterator] = useState(() => records.filter(record => record.action === "conflict").values())
    const [currentRecord, setCurrentRecord] = useState(() => recordsIterator.next().value)

    const [applyToAll, setApplyToAll] = useState(false)

    const fixedRecords = useRef<ImportResultItem[]>(records)

    const moveToNextRecord = useCallback(() => {
        const next = recordsIterator.next()
        if (next.done) {
            onAllConflictsResolved(fixedRecords.current)
        } else {
            setCurrentRecord(next.value)
        }
    }, [recordsIterator, onAllConflictsResolved])

    const setAction = useCallback(
        (record: ImportResultItem, action: "onConflictUpdate" | "onConflictSkip") => {
            if (!currentRecord) return

            fixedRecords.current = fixedRecords.current.map(existingRecord => {
                if (existingRecord.slug === record.slug) {
                    return { ...existingRecord, action }
                }
                return existingRecord
            })
        },
        [currentRecord]
    )

    const applyAction = useCallback(
        async (action: "onConflictUpdate" | "onConflictSkip") => {
            if (!currentRecord) return

            if (!applyToAll) {
                setAction(currentRecord, action)
                moveToNextRecord()
                return
            }

            let current = currentRecord
            do {
                setAction(current, action)
                const next = recordsIterator.next()
                if (next.done) {
                    onAllConflictsResolved(fixedRecords.current)
                    break
                }
                current = next.value
            } while (current)
        },
        [currentRecord, applyToAll, setAction, moveToNextRecord, recordsIterator, onAllConflictsResolved]
    )

    if (!currentRecord) return null

    return (
        <form
            onSubmit={async event => {
                event.preventDefault()
                await applyAction("onConflictUpdate")
            }}
            className="manage-conflicts"
        >
            <div className="content">
                <div className="message">
                    <span style={{ color: "var(--framer-color-text)", fontWeight: 600 }}>“{currentRecord.slug}”</span>
                    <p>An item with this slug field value already exists in this Collection.</p>
                </div>

                <label className="apply-to-all">
                    <input
                        type="checkbox"
                        id="apply-to-all"
                        checked={applyToAll}
                        onChange={event => setApplyToAll(event.currentTarget.checked)}
                    />
                    Apply to all
                </label>
            </div>

            <hr />

            <div className="actions">
                <button type="button" onClick={async () => applyAction("onConflictSkip")}>
                    Skip Item
                </button>
                <button type="submit" className="framer-button-primary">
                    Update Item
                </button>
            </div>
        </form>
    )
}
