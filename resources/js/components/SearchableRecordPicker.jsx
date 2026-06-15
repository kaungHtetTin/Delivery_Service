import { useEffect, useId, useState } from "react";
import { Icon } from "../icons";

export function SearchableRecordPicker({
  disabled = false,
  emptyHint = "Type at least 2 characters to search.",
  getOptionMeta,
  getOptionTitle,
  hint,
  label,
  minQueryLength = 2,
  onClear,
  onSelect,
  placeholder = "Search...",
  searchRecords,
  selectedMeta = "",
  selectedTitle = "",
  value,
}) {
  const listId = useId();
  const [open, setOpen] = useState(!value);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < minQueryLength) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const records = await searchRecords(query.trim());
        if (!cancelled) {
          setResults(records);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [minQueryLength, open, query, searchRecords]);

  const hasSelection = Boolean(value);

  return (
    <div className={`record-picker ${disabled ? "disabled" : ""}`}>
      <span className="field-label">{label}</span>
      {hint && <small className="record-picker-hint">{hint}</small>}

      {hasSelection && !open ? (
        <div className="record-picker-selected glass">
          <div className="record-picker-selected-copy">
            <strong>{selectedTitle || "Selected record"}</strong>
            {selectedMeta && <small>{selectedMeta}</small>}
          </div>
          <div className="record-picker-selected-actions">
            <button className="text-btn" disabled={disabled} onClick={() => setOpen(true)} type="button">Change</button>
            <button
              className="icon-btn small"
              disabled={disabled}
              onClick={() => {
                onClear?.();
                setOpen(true);
                setQuery("");
                setResults([]);
              }}
              title="Clear selection"
              type="button"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="search-box record-picker-search">
            <Icon name="search" size={16} />
            <input
              aria-controls={listId}
              disabled={disabled}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              value={query}
            />
          </label>
          <div className="record-picker-results glass" id={listId}>
            {loading && <p className="muted record-picker-status">Searching...</p>}
            {!loading && query.trim().length < minQueryLength && (
              <p className="muted record-picker-status">{emptyHint}</p>
            )}
            {!loading && query.trim().length >= minQueryLength && results.length === 0 && (
              <p className="muted record-picker-status">No matches found.</p>
            )}
            {!loading && results.map((record) => (
              <button
                className="record-picker-option"
                disabled={disabled}
                key={record._apiId ?? record.id}
                onClick={() => {
                  onSelect(record);
                  setOpen(false);
                  setQuery("");
                  setResults([]);
                }}
                type="button"
              >
                <strong>{getOptionTitle(record)}</strong>
                {getOptionMeta(record) && <small>{getOptionMeta(record)}</small>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
