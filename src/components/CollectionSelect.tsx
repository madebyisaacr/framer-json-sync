import { ChangeEvent } from "react"
import { Collection } from "framer-plugin"

export default function CollectionSelect({
    selectedCollection,
    collections,
    isLoading,
    selectCollection,
}: {
    selectedCollection: Collection
    collections: Collection[]
    isLoading: boolean
    selectCollection: (event: ChangeEvent<HTMLSelectElement>) => void
}) {
    const editableCollections = collections.filter(collection => !collection.readonly)
    const readOnlyCollections = collections.filter(collection => collection.readonly)

    return (
        <select
            onChange={selectCollection}
            className={!selectedCollection ? "footer-select footer-select-unselected" : "footer-select"}
            value={selectedCollection?.id ?? ""}
        >
            <option value="" disabled>
                {isLoading ? "Loading collections…" : "Select Collection…"}
            </option>

            {editableCollections.map(collection => (
                <option key={collection.id} value={collection.id}>
                    {collection.name}
                </option>
            ))}
            {readOnlyCollections.map(collection => (
                <option key={collection.id} value={collection.id}>
                    {collection.name}
                </option>
            ))}
        </select>
    )
}
