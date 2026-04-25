'use client';

/**
 * Shared display of the current EEG viewing window as both an elapsed-time
 * range and (when available) the absolute wall-clock range. Used at the
 * top of the chart and inside the time slider so both places format the
 * numbers identically.
 *
 * EDF does not encode a timezone; absolute times are rendered in the
 * viewer's local timezone, with a full ISO tooltip on hover for precision.
 */

interface EEGTimeRangeProps {
  currentStart: number;
  windowDuration: number;
  totalDuration: number;
  startDateTime?: Date | null;
  /**
   * Layout orientation. Vertical stacks elapsed over absolute (used in the
   * slider where space is tight). Horizontal shows them side-by-side (used
   * above the chart where we have full width).
   */
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

// HH:MM:SS in the viewer's local timezone; milliseconds appended when the
// window boundary isn't on a whole second (e.g. after slider drags) so the
// user can still see exactly where they are.
function formatClockTime(d: Date): string {
  const base = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const ms = d.getMilliseconds();
  return ms === 0 ? base : `${base}.${ms.toString().padStart(3, '0')}`;
}

export default function EEGTimeRange({
  currentStart,
  windowDuration,
  totalDuration,
  startDateTime,
  orientation = 'vertical',
  className = '',
}: EEGTimeRangeProps) {
  const endTime = Math.min(currentStart + windowDuration, totalDuration);

  const windowStartClock = startDateTime
    ? new Date(startDateTime.getTime() + currentStart * 1000)
    : null;
  const windowEndClock = startDateTime
    ? new Date(startDateTime.getTime() + endTime * 1000)
    : null;

  const elapsedText = (
    <span className="text-gray-600">
      {currentStart.toFixed(1)}s - {endTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
    </span>
  );

  const absoluteText =
    windowStartClock && windowEndClock ? (
      <span
        className="text-gray-800 font-mono tabular-nums"
        title={`${windowStartClock.toISOString()} – ${windowEndClock.toISOString()}`}
      >
        {formatClockTime(windowStartClock)} - {formatClockTime(windowEndClock)}
      </span>
    ) : null;

  if (orientation === 'horizontal') {
    return (
      <div className={`flex flex-wrap items-center gap-x-3 text-xs ${className}`}>
        {elapsedText}
        {absoluteText && (
          <>
            <span className="text-gray-400">|</span>
            {absoluteText}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col whitespace-nowrap leading-tight text-xs ${className}`}>
      {elapsedText}
      {absoluteText}
    </div>
  );
}
