export interface EEGAnnotation {
  id: string;
  dbId?: string;
  startTime: number;
  endTime: number;
  description: string;
  type: 'artifact' | 'event' | 'note' | 'rejected';
  color?: string;
  readOnly?: boolean;
}

export interface FilterSettings {
  sensitivityMicrovolts: number;
  windowDurationSeconds: number;
  lowpassHz: number;
  highpassHz: number;
  notchHz: number;
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  sensitivityMicrovolts: 70,
  windowDurationSeconds: 10,
  lowpassHz: 70,
  highpassHz: 0.5,
  notchHz: 60,
};

export interface UnifiedSignalData {
  signals: number[][];
  sampleRate: number;
  duration: number;
  channelNames: string[];
  fileType: 'edf' | 'bdf' | 'csv';
  /**
   * Wall-clock time at which the recording started, when the source file
   * carries it. EDF/BDF encode this in the fixed header; CSV does not, so
   * this is null for CSV uploads. EDF does not encode a timezone, so the
   * Date is interpreted in the viewer's local timezone.
   */
  startDateTime: Date | null;
}

export interface RejectedEpoch {
  start: number;
  end: number;
  reason: string;
  condition: string;
}

export interface AnnotationDragState {
  isDragging: boolean;
  startX: number;
  endX: number;
  startTime: number;
  endTime: number;
}
