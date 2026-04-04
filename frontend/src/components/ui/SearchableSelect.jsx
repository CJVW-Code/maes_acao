import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X } from "lucide-react";

/**
 * SearchableSelect - A custom select component with filtering
 * @param {Array} options - List of { value, label }
 * @param {string} value - Current value
 * @param {function} onChange - Callback for value changes
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional CSS classes
 */
export const SearchableSelect = ({
  options = [],
  value = "",
  onChange,
  placeholder = "Selecione...",
  className = "",
  name = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // Sync searchTerm with current value's label when not open
  useEffect(() => {
    if (!isOpen) {
      if (!value) {
        setSearchTerm("");
        return;
      }
      const selectedOption = options.find((o) => o.value === value);
      setSearchTerm(selectedOption ? selectedOption.label : "");
    }
  }, [value, isOpen, options]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option) => {
    onChange({ target: { name, value: option.value } });
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: "" } });
    setSearchTerm("");
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className={`input flex items-center gap-2 cursor-text transition-all ${
          isOpen ? "ring-2 ring-primary border-primary bg-surface" : ""
        }`}
        onClick={() => setIsOpen(true)}
      >
        <Search className="text-muted shrink-0" size={16} />
        <input
          type="text"
          className="bg-transparent border-none outline-none w-full p-0 text-sm focus:ring-0"
          placeholder={placeholder}
          name={name}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {value && (
          <button
            type="button"
            onClick={clearSelection}
            className="text-muted hover:text-error transition-colors p-1"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown
          className={`text-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={16}
        />
      </div>

      {isOpen && searchTerm.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-soft rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredOptions.length > 0 ? (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li
                  key={option.value}
                  className={`px-4 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                    value === option.value
                      ? "bg-primary/10 text-primary font-bold"
                      : "hover:bg-app text-text"
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                  {value === option.value && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-muted text-center italic">
              Nenhum órgão encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
};
