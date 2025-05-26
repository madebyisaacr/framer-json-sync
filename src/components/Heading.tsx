export default function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
        <div className="intro">
            <div className="logo">
                <ImportIcon />
            </div>
            <div className="content">
                <h2>{title}</h2>
                <p>{children}</p>
            </div>
        </div>
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
