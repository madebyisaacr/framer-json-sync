import Heading from "./Heading"

export default function MainMenu({ setType }: { setType: (type: "import" | "export") => void }) {
    return (
        <div className="import-collection">
            <Heading title="JSON Sync">Import and export CMS content using JSON files.</Heading>
            <div className="menu-buttons-container">
                <MenuButton title="Import" icon={<MenuButtonIcon isImport />} onClick={() => setType("import")} />
                <MenuButton title="Export" icon={<MenuButtonIcon />} onClick={() => setType("export")} />
            </div>
        </div>
    )
}

const MenuButton = ({ icon, title, onClick }: { icon: React.ReactElement; title: string; onClick?: () => void }) => {
    return (
        <button className="menu-button" onClick={onClick ? () => onClick() : undefined}>
            {icon}
            <p>{title}</p>
        </button>
    )
}

function MenuButtonIcon({ isImport = false }: { isImport?: boolean }) {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
                rotate: isImport ? "180deg" : "0deg",
            }}
        >
            <path
                d="M14 0C16.2091 0 18 1.79086 18 4V14C18 16.2091 16.2091 18 14 18H4C1.79086 18 1.61066e-08 16.2091 0 14V4C0 1.79086 1.79086 1.61064e-08 4 0H14ZM9.83887 3.44824C9.39975 3.00913 8.68716 3.00913 8.24805 3.44824L4.00586 7.69043C3.56675 8.12954 3.56675 8.84214 4.00586 9.28125C4.44497 9.72036 5.15757 9.72036 5.59668 9.28125L7.91504 6.96289V13.6689C7.91522 14.2902 8.41981 14.7929 9.04004 14.792C9.66038 14.7931 10.1648 14.2893 10.165 13.668V6.95605L12.4902 9.28125C12.9293 9.72036 13.6429 9.72036 14.082 9.28125C14.5207 8.84211 14.521 8.12941 14.082 7.69043L9.83887 3.44824Z"
                fill="currentColor"
            />
        </svg>
    )
}
