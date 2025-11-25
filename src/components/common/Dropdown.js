import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

/**
 * Reusable Dropdown Component with good design
 * @param {Object} props
 * @param {Array} props.options - Array of options {id, label, value, status?, icon?}
 * @param {string|number} props.value - Selected value
 * @param {Function} props.onChange - Callback when selection changes
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.label - Label text
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.disabled - Disabled state
 * @param {boolean} props.searchable - Enable search functionality
 * @param {string} props.emptyMessage - Message when no options available
 */
const Dropdown = ({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  label,
  loading = false,
  disabled = false,
  searchable = false,
  emptyMessage = "No options available",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens and searchable is true
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Filter options based on search query
  const filteredOptions = searchable
    ? options.filter((option) => option.label?.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  // Get selected option
  const selectedOption =
    value !== null && value !== undefined && value !== ""
      ? options.find((opt) => opt.value === value)
      : null;

  // Handle option selection
  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div
      className={`relative ${className}`}
      ref={dropdownRef}
    >
      {/* Label */}
      {label && <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>}

      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2.5 text-sm
          focus:outline-none focus:ring-0
          transition-all duration-200 ease-in-out
          flex items-center justify-between gap-2
          ${
            disabled || loading
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-slate-600 hover:border-slate-500 cursor-pointer"
          }
        `}
      >
        <span className="flex-1 text-left truncate">
          {loading ? (
            <span className="text-slate-400">Loading...</span>
          ) : selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon && <span className="text-slate-400">{selectedOption.icon}</span>}
              <span>{selectedOption.label}</span>
              {selectedOption.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    selectedOption.status === "ACTIVE"
                      ? "bg-green-500/20 text-green-400"
                      : selectedOption.status === "PAUSED"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-slate-600 text-slate-300"
                  }`}
                >
                  {selectedOption.status}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && !loading && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-slate-600">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-md px-4 pl-10 py-2 text-sm focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.id || option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`
                      w-full px-4 py-2.5 text-left text-sm transition-colors duration-150
                      flex items-center justify-between gap-2
                      ${
                        isSelected
                          ? "bg-blue-500/20 text-blue-400"
                          : "text-slate-100 hover:bg-slate-700"
                      }
                    `}
                  >
                    <span className="flex items-center gap-2 flex-1 min-w-0">
                      {option.icon && (
                        <span className="text-slate-400 flex-shrink-0">{option.icon}</span>
                      )}
                      <span className="truncate">{option.label}</span>
                      {option.status && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            option.status === "ACTIVE"
                              ? "bg-green-500/20 text-green-400"
                              : option.status === "PAUSED"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-slate-600 text-slate-300"
                          }`}
                        >
                          {option.status}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                {searchQuery ? "No results found" : emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
