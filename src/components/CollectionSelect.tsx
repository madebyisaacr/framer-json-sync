import { useRef } from "react"
import { Collection, framer } from "@framer/plugin"
import cx from "classnames"

export default function CollectionSelect({
    selectedCollection,
    collections,
    isLoading,
    selectCollection,
}: {
    selectedCollection: Collection | null
    collections: Collection[]
    isLoading: boolean
    selectCollection: (collectionId: string) => void
}) {
    const buttonRef = useRef<HTMLDivElement>(null)

    const editableCollections = collections.filter(collection => !collection.readonly)
    const readOnlyCollections = collections.filter(collection => collection.readonly)

    const showDropdown = () => {
        if (isLoading || collections.length === 0) return

        const rect = buttonRef.current?.getBoundingClientRect()

        void framer.showContextMenu(
            [
                ...editableCollections.map(collection => ({
                    label: collection.name,
                    checked: selectedCollection?.id === collection.id,
                    onAction: () => selectCollection(collection.id),
                })),
                ...(editableCollections.length > 0 && readOnlyCollections.length > 0
                    ? [{ type: "separator" as const }]
                    : []),
                ...readOnlyCollections.map(collection => ({
                    label: collection.name,
                    checked: selectedCollection?.id === collection.id,
                    onAction: () => selectCollection(collection.id),
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

    const displayName = selectedCollection?.name ?? (isLoading ? "Loading collections…" : "Select Collection…")

    return (
        <div
            ref={buttonRef}
            className={cx("collection-dropdown two-columns", !selectedCollection ? "collection-dropdown-unselected" : "")}
            aria-label="Collection"
            onClick={showDropdown}
        >
            {displayName}
            <svg
                role="presentation"
                xmlns="http://www.w3.org/2000/svg"
                width="8"
                height="8"
                viewBox="0 0 8 8"
                aria-hidden="true"
            >
                <path
                    d="m1 2.75 2.293 2.293a1 1 0 0 0 1.414 0L7 2.75"
                    fill="transparent"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}
