import { forwardRef, type MouseEventHandler, type ReactNode } from "react"
import cx from "classnames"

type DropdownButtonProps = {
    label: ReactNode
    secondaryLabel?: ReactNode
    unselected?: boolean
    className?: string
    "aria-label"?: string
    onClick?: MouseEventHandler<HTMLDivElement>
}

const DropdownButton = forwardRef<HTMLDivElement, DropdownButtonProps>(function DropdownButton(
    { label, secondaryLabel, unselected, className, onClick, "aria-label": ariaLabel },
    ref
) {
    return (
        <div
            ref={ref}
            className={cx("dropdown-button", unselected && "dropdown-button-unselected", className)}
            aria-label={ariaLabel}
            onClick={onClick}
        >
            <span className="dropdown-button-label">{label}</span>
            {secondaryLabel != null && secondaryLabel !== "" ? (
                <span className="dropdown-button-secondary">{secondaryLabel}</span>
            ) : null}
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
})

export default DropdownButton
