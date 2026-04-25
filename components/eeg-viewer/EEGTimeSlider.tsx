'use client';

import EEGTimeRange from './EEGTimeRange';

interface EEGTimeSliderProps {
  currentStart: number;
  windowDuration: number;
  totalDuration: number;
  onTimeChange: (newStart: number) => void;
  /**
   * Wall-clock time at which the recording started, if the source format
   * provides it (EDF/BDF). When supplied, the slider label shows the
   * absolute clock time of the current window in addition to the elapsed
   * offset. CSV uploads pass null and fall back to elapsed-only.
   */
  startDateTime?: Date | null;
}

export default function EEGTimeSlider({
  currentStart,
  windowDuration,
  totalDuration,
  onTimeChange,
  startDateTime,
}: EEGTimeSliderProps) {
  const maxStart = Math.max(0, totalDuration - windowDuration);

  const handlePrev = () => {
    onTimeChange(Math.max(0, currentStart - windowDuration));
  };

  const handleNext = () => {
    onTimeChange(Math.min(maxStart, currentStart + windowDuration));
  };

  return (
    <div className="flex items-center gap-3 mt-2">
      <button
        onClick={handlePrev}
        disabled={currentStart <= 0}
        className="px-3 py-1 bg-neuro-primary text-white rounded text-sm disabled:opacity-50 hover:bg-neuro-accent transition-colors"
      >
        Prev
      </button>

      <input
        type="range"
        min={0}
        max={maxStart}
        step={0.1}
        value={currentStart}
        onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        className="flex-1 accent-neuro-primary h-2"
      />

      <button
        onClick={handleNext}
        disabled={currentStart + windowDuration >= totalDuration}
        className="px-3 py-1 bg-neuro-primary text-white rounded text-sm disabled:opacity-50 hover:bg-neuro-accent transition-colors"
      >
        Next
      </button>

      <EEGTimeRange
        currentStart={currentStart}
        windowDuration={windowDuration}
        totalDuration={totalDuration}
        startDateTime={startDateTime}
        orientation="vertical"
        className="items-end min-w-[180px]"
      />
    </div>
  );
}
