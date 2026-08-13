"use client";

import { Fragment } from "react";

type Stop = { name: string; suspended?: boolean };

const PER_ROW = 3;

// Three stops per row, laid out as a snake: the first row runs left to right,
// the next runs right to left, and a turn arrow carries the eye down between
// them. That is what makes a wrapped list read as a route rather than as a
// grid — the path never jumps back across the card.
//
// The columns are a fixed `1fr arrow 1fr arrow 1fr` grid and every item is
// placed explicitly, so a final row holding one or two stops keeps exactly the
// same column widths as a full one.
export function RouteMap({ stops }: { stops: Stop[] }) {
  const rows: Stop[][] = [];
  for (let i = 0; i < stops.length; i += PER_ROW) {
    rows.push(stops.slice(i, i + PER_ROW));
  }

  return (
    <div className="routemap" role="list" aria-label="Route stops in order">
      {rows.map((row, r) => {
        // Odd rows run backwards, so both their stops and their arrows are
        // mirrored across the grid.
        const rtl = r % 2 === 1;
        const gridRow = 2 * r + 1;

        return (
          <Fragment key={r}>
            {row.map((stop, k) => {
              const index = r * PER_ROW + k;
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;
              const hasArrow = k < row.length - 1;

              return (
                <Fragment key={`${stop.name}-${index}`}>
                  <div
                    role="listitem"
                    className="routemap-node"
                    data-suspended={stop.suspended || undefined}
                    data-edge={isFirst ? "start" : isLast ? "end" : undefined}
                    style={{ gridColumn: rtl ? 5 - 2 * k : 1 + 2 * k, gridRow }}
                  >
                    <span className="routemap-dot">{index + 1}</span>
                    <span className="routemap-body">
                      <span className="routemap-name" title={stop.name}>
                        {stop.name}
                      </span>
                      {(isFirst || isLast || stop.suspended) && (
                        <span className="routemap-tags">
                          {isFirst && (
                            <span className="routemap-tag">Start</span>
                          )}
                          {isLast && <span className="routemap-tag">End</span>}
                          {stop.suspended && (
                            <span className="routemap-tag routemap-tag-off">
                              Suspended
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </div>

                  {hasArrow && (
                    <span
                      className="routemap-arrow"
                      data-flip={rtl || undefined}
                      aria-hidden
                      style={{
                        gridColumn: rtl ? 4 - 2 * k : 2 + 2 * k,
                        gridRow,
                      }}
                    >
                      <Arrow />
                    </span>
                  )}
                </Fragment>
              );
            })}

            {/* The turn down to the next row, on whichever side the path
                happens to end. */}
            {r < rows.length - 1 && (
              <span
                className="routemap-turn"
                aria-hidden
                style={{ gridColumn: rtl ? 1 : 5, gridRow: gridRow + 1 }}
              >
                <Arrow />
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 28 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 6h24" strokeDasharray="3 3" />
      <path d="M20 1.5 25 6l-5 4.5" />
    </svg>
  );
}
