import React, { useRef } from 'react'
import { IoSearchOutline, IoClose } from 'react-icons/io5'

export default function SearchBox({ value, onChange, placeholder = 'Search customer...' }) {
  const inputRef = useRef(null)

  const handleClear = () => {
    onChange({ target: { value: '' } })
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Handle keyboard events (e.g., clearing on Escape key)
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClear()
    }
  }

  return (
    <div className="w-full px-3 py-2 flex items-center bg-whatsapp-sidebar">
      <div className="w-full relative flex items-center bg-whatsapp-input rounded-lg px-3 py-1.5 transition-all duration-200 focus-within:ring-1 focus-within:ring-whatsapp-teal/50">
        <label htmlFor="customer-search" className="sr-only">Search customer</label>
        <IoSearchOutline className="text-whatsapp-gray w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
        
        <input
          ref={inputRef}
          id="customer-search"
          type="text"
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search customer list"
          autoComplete="off"
          // Note: Ready for future debounce wrapping in parent components (e.g., _.debounce(onChange, 300))
          className="w-full bg-transparent text-white placeholder-whatsapp-gray text-sm focus:outline-none border-none p-0"
        />

        {value && (
          <button
            onClick={handleClear}
            className="text-whatsapp-gray hover:text-white transition-colors duration-150 p-0.5 rounded-full hover:bg-whatsapp-panel focus:outline-none focus:ring-1 focus:ring-whatsapp-teal/40"
            title="Clear search"
            aria-label="Clear search input"
          >
            <IoClose className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
