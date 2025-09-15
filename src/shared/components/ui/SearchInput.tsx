import {forwardRef, InputHTMLAttributes} from "react"
import Icon from "@/shared/components/Icons/Icon"
import classNames from "classnames"

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string
  onClear?: () => void
  containerClassName?: string
  iconClassName?: string
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({value, onClear, containerClassName, iconClassName, className, ...props}, ref) => {
    const handleClear = () => {
      if (onClear) {
        onClear()
      }
    }

    return (
      <label
        className={classNames(
          "input input-bordered flex items-center gap-2 w-full",
          containerClassName
        )}
      >
        <input
          ref={ref}
          type="text"
          className={classNames("grow", className)}
          value={value}
          {...props}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-neutral-content/60 hover:text-base-content transition-colors"
            aria-label="Clear search"
          >
            <Icon name="close" className={classNames("w-4 h-4", iconClassName)} />
          </button>
        ) : (
          <Icon
            name="search-outline"
            className={classNames("text-neutral-content/60", iconClassName)}
          />
        )}
      </label>
    )
  }
)

SearchInput.displayName = "SearchInput"

export default SearchInput
