import { useRef, useCallback, useState } from "react"
import type { ImportResultItem } from "../json-import"

export default function ManageConflicts({
    records,
    onAllConflictsResolved,
}: {
    records: ImportResultItem[]
    onAllConflictsResolved: (items: ImportResultItem[]) => void
}) {
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
