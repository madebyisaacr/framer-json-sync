import { useRef } from "react"
import { Collection, framer } from "@framer/plugin"
import DropdownButton from "./DropdownButton"

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
        <DropdownButton
            ref={buttonRef}
            className="two-columns"
            label={displayName}
            unselected={!selectedCollection}
            aria-label="Collection"
            onClick={showDropdown}
        />
    )
}
