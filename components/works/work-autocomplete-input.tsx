"use client";

import { type ComponentProps, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WorkAutocompleteInputProps = Omit<
  ComponentProps<"input">,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  maxOptions?: number;
};

function normalize(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function uniqueSortedOptions(options: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const option of options) {
    const trimmed = option.trim();
    const key = normalize(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }

  return unique.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

export function WorkAutocompleteInput({
  id,
  value,
  onValueChange,
  options,
  maxOptions = 8,
  className,
  disabled,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: WorkAutocompleteInputProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${id ?? generatedId}-suggestions`;

  const sortedOptions = useMemo(() => uniqueSortedOptions(options), [options]);
  const visibleOptions = useMemo(() => {
    const query = normalize(value);
    const filtered = query
      ? sortedOptions.filter((option) => normalize(option).startsWith(query))
      : sortedOptions;

    return filtered.slice(0, maxOptions);
  }, [maxOptions, sortedOptions, value]);

  const showSuggestions = open && !disabled && visibleOptions.length > 0;
  const activeOptionId =
    showSuggestions && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  function selectOption(option: string) {
    onValueChange(option);
    setOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listId : undefined}
        aria-activedescendant={activeOptionId}
        className={className}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          window.setTimeout(() => {
            setOpen(false);
            setActiveIndex(-1);
          }, 120);
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            if (visibleOptions.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                current < visibleOptions.length - 1 ? current + 1 : 0,
              );
            }
          } else if (event.key === "ArrowUp") {
            if (visibleOptions.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) =>
                current > 0 ? current - 1 : visibleOptions.length - 1,
              );
            }
          } else if (event.key === "Enter" && showSuggestions && activeIndex >= 0) {
            event.preventDefault();
            selectOption(visibleOptions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          }
          onKeyDown?.(event);
        }}
        {...props}
      />
      {showSuggestions && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-56 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {visibleOptions.map((option, index) => (
            <button
              id={`${listId}-${index}`}
              key={option}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              className={cn(
                "flex min-h-8 w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm leading-snug transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                activeIndex === index && "bg-muted",
              )}
              title={option}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              <span className="break-words">{option}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
