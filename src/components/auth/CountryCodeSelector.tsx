import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { COUNTRIES, type CountryInfo } from "./countries";

export { COUNTRIES, type CountryInfo };

interface CountryCodeSelectorProps {
  id?: string;
  value: string; // Clean local number only
  onChange: (localNumber: string, fullE164: string, country: CountryInfo) => void;
  selectedCountry?: CountryInfo;
  onCountryChange?: (country: CountryInfo) => void;
  disabled?: boolean;
}

export function CountryCodeSelector({
  id = "reg-phone",
  value,
  onChange,
  selectedCountry: controlledCountry,
  onCountryChange,
  disabled = false,
}: CountryCodeSelectorProps) {
  // Default country is India (+91)
  const defaultCountry = COUNTRIES[0]!;
  const [internalCountry, setInternalCountry] = useState<CountryInfo>(defaultCountry);
  const country = controlledCountry || internalCountry;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredCountries = COUNTRIES.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  function selectCountry(newCountry: CountryInfo) {
    if (onCountryChange) {
      onCountryChange(newCountry);
    } else {
      setInternalCountry(newCountry);
    }
    setIsOpen(false);
    setSearchQuery("");

    // Notify parent with clean combined E.164 number
    const cleanDigits = value.replace(/\D/g, "");
    const fullE164 = cleanDigits ? `${newCountry.dialCode}${cleanDigits}` : "";
    onChange(cleanDigits, fullE164, newCountry);
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value;

    // If user accidentally typed or pasted the dial code (e.g. +919876543210 or 919876543210)
    // strip the dial code so only the national number is kept
    const rawNoPlus = raw.replace(/^\+/, "");
    const dialDigits = country.dialCode.replace(/^\+/, "");
    if (rawNoPlus.startsWith(dialDigits) && rawNoPlus.length > country.maxLength) {
      raw = rawNoPlus.slice(dialDigits.length);
    }

    // Keep only numeric characters
    const cleanDigits = raw.replace(/\D/g, "").slice(0, country.maxLength);
    const fullE164 = cleanDigits ? `${country.dialCode}${cleanDigits}` : "";
    onChange(cleanDigits, fullE164, country);
  }

  return (
    <div suppressHydrationWarning className="relative w-full">
      <div className="flex items-stretch mt-1.5">
        {/* Country Selector Button: [ 🇮🇳 India +91 ▼ ] */}
        <div ref={dropdownRef} className="relative">
          <button
            suppressHydrationWarning
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className="flex h-10 shrink-0 items-center justify-between gap-1.5 border border-r-0 border-ink-border bg-ink-foreground/[0.04] px-2.5 sm:px-3 text-xs font-medium text-ink-foreground transition-colors hover:bg-ink-foreground/[0.08] focus:outline-none focus:ring-1 focus:ring-ink-border cursor-pointer"
            title={`${country.name} (${country.dialCode})`}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="hidden sm:inline-block max-w-[90px] truncate">{country.name}</span>
            <span className="font-mono font-semibold text-ink-foreground/90">
              {country.dialCode}
            </span>
            <ChevronDown
              className={`size-3 text-ink-foreground/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown Popover */}
          {isOpen && (
            <div
              suppressHydrationWarning
              className="absolute left-0 top-full z-50 mt-1 w-72 border border-ink-border bg-[#101214] shadow-2xl backdrop-blur-xl"
            >
              {/* Search input */}
              <div className="flex items-center border-b border-ink-border px-3 py-2">
                <Search className="size-3.5 shrink-0 text-ink-foreground/50" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country or code..."
                  className="ml-2 w-full bg-transparent text-xs text-ink-foreground placeholder:text-ink-foreground/40 focus:outline-none"
                />
              </div>

              {/* Scrollable country list */}
              <ul
                role="listbox"
                className="max-h-60 overflow-y-auto divide-y divide-ink-border/30 text-xs py-1"
              >
                {filteredCountries.length === 0 ? (
                  <li className="px-3 py-4 text-center text-ink-foreground/50">
                    No country matches "{searchQuery}"
                  </li>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = c.code === country.code;
                    return (
                      <li key={c.code}>
                        <button
                          type="button"
                          onClick={() => selectCountry(c)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer hover:bg-ink-foreground/[0.08] ${
                            isSelected ? "bg-ink-foreground/[0.06] font-semibold" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-base leading-none">{c.flag}</span>
                            <span className="truncate text-ink-foreground">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="font-mono text-[11px] text-ink-foreground/60">
                              {c.dialCode}
                            </span>
                            {isSelected && <Check className="size-3 text-ink-foreground" />}
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Local Phone Number Input: [ 9876543210 ] */}
        <input
          suppressHydrationWarning
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          disabled={disabled}
          value={value}
          onChange={handleNumberChange}
          placeholder={country.placeholder}
          className="flex h-10 w-full rounded-none border border-ink-border bg-transparent px-3 text-sm text-ink-foreground placeholder:text-ink-foreground/30 focus-visible:outline-none focus-visible:border-ink-foreground/60 transition-colors"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[0.72rem] text-ink-foreground/50">
        <span>
          {country.code === "IN"
            ? "Enter 10-digit mobile number (e.g. 9876543210)"
            : `Enter ${country.minLength === country.maxLength ? `${country.minLength}-digit` : `${country.minLength}-${country.maxLength} digit`} local number`}
        </span>
        {value.length > 0 && (
          <span className="font-mono text-ink-foreground/40">
            {value.length}/{country.maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
