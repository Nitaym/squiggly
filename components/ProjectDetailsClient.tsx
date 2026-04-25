'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ComparisonView from './ComparisonView';
import { formatDateStable } from '@/lib/date-format';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
}

interface Recording {
  id: string;
  filename: string;
  notes: string | null;
  file_size: number;
  duration_seconds: number | null;
  created_at: string;
  eo_start: number | null;
  eo_end: number | null;
  ec_start: number | null;
  ec_end: number | null;
}

interface ProjectDetailsClientProps {
  project: Project;
  user: { id: string; email: string };
}

type TabType = 'recordings' | 'overview' | 'comparison';

const EO_EC_COLUMN_PREF_KEY = 'squiggly:projectDetails:showEoEcColumn';

export default function ProjectDetailsClient({
  project,
  user,
}: ProjectDetailsClientProps) {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [notesStatus, setNotesStatus] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('recordings');
  const [showEoEcColumn, setShowEoEcColumn] = useState<boolean>(false);

  useEffect(() => {
    fetchRecordings();
  }, []);

  // Hydrate EO/EC column visibility preference from localStorage after mount
  // (defer to client to avoid SSR/CSR markup mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(EO_EC_COLUMN_PREF_KEY);
    if (stored === 'true') setShowEoEcColumn(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(EO_EC_COLUMN_PREF_KEY, String(showEoEcColumn));
  }, [showEoEcColumn]);

  const fetchRecordings = async () => {
    try {
      const response = await fetch(`/api/recordings?project_id=${project.id}`);
      if (!response.ok) throw new Error('Failed to fetch recordings');
      const data = await response.json();
      const fetchedRecordings = data.recordings || [];
      setRecordings(fetchedRecordings);
      setEditingNotes(
        fetchedRecordings.reduce((acc: Record<string, string>, recording: Recording) => {
          acc[recording.id] = recording.notes || '';
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleViewAnalysis = async (recordingId: string) => {
    try {
      // Fetch analyses for this recording to check if one exists
      const checkResponse = await fetch(`/api/recordings?recording_id=${recordingId}&include_analyses=true`);
      if (checkResponse.ok) {
        const data = await checkResponse.json();
        const recording = data.recordings?.[0];
        if (recording?.analyses?.length > 0) {
          // Navigate to most recent analysis
          router.push(`/analyses/${recording.analyses[0].id}`);
          return;
        }
      }

      // If no analysis exists, create one via the recordings API
      // This will be handled by the analysis page which creates analyses on-demand
      // For now, we'll call a hypothetical create endpoint or navigate to trigger creation
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId,
          createAnalysis: true,
        }),
      });

      if (!createResponse.ok) {
        // If the special create doesn't work, just navigate to the recording
        // and let the user trigger analysis from there
        router.push(`/analyses/new?recording=${recordingId}`);
        return;
      }

      const result = await createResponse.json();
      if (result.analysis?.id) {
        router.push(`/analyses/${result.analysis.id}`);
      }
    } catch (error) {
      console.error('Error handling analysis:', error);
      alert('Failed to load or create analysis. Please try again.');
    }
  };

  const handleDeleteRecording = async (recordingId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will also delete all associated analyses and cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete recording');
      }

      // Refresh recordings list
      await fetchRecordings();
      alert('Recording deleted successfully');
    } catch (error) {
      console.error('Error deleting recording:', error);
      alert('Failed to delete recording. Please try again.');
    }
  };

  const handleNoteChange = (recordingId: string, value: string) => {
    setEditingNotes((prev) => ({
      ...prev,
      [recordingId]: value,
    }));
    setNotesStatus((prev) => ({
      ...prev,
      [recordingId]: '',
    }));
  };

  const handleSaveNotes = async (recordingId: string) => {
    setSavingNoteId(recordingId);
    setNotesStatus((prev) => ({ ...prev, [recordingId]: '' }));

    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editingNotes[recordingId] ?? '',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save notes');
      }

      const data = await response.json();
      const updatedRecording = data.recording as Recording;

      setRecordings((prev) =>
        prev.map((recording) =>
          recording.id === recordingId
            ? { ...recording, notes: updatedRecording.notes }
            : recording
        )
      );
      setEditingNotes((prev) => ({
        ...prev,
        [recordingId]: updatedRecording.notes || '',
      }));
      setNotesStatus((prev) => ({ ...prev, [recordingId]: 'Saved' }));
    } catch (error: any) {
      console.error('Error saving recording notes:', error);
      setNotesStatus((prev) => ({
        ...prev,
        [recordingId]: error.message || 'Failed to save',
      }));
    } finally {
      setSavingNoteId(null);
    }
  };

  return (
    <main className="min-h-screen bg-neuro-light">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-2xl font-bold text-neuro-primary hover:text-neuro-accent transition-colors"
              >
                Squiggly
              </button>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-800 hover:text-neuro-primary transition-colors"
              >
                Projects
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-800">{user.email}</div>
              <button
                onClick={handleSignOut}
                className="bg-neuro-primary text-white px-4 py-2 rounded-lg hover:bg-neuro-accent transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-neuro-dark mb-2">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-gray-800">{project.description}</p>
              )}
              <p className="text-sm text-gray-700 mt-2">
                Created {formatDateStable(project.created_at)}
              </p>
            </div>
            <button
              onClick={() => router.push(`/projects/${project.id}/upload`)}
              className="bg-neuro-primary text-white px-6 py-3 rounded-lg hover:bg-neuro-accent transition-colors font-medium"
            >
              + Upload Recording
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('recordings')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'recordings'
                    ? 'border-neuro-primary text-neuro-primary'
                    : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Recordings ({recordings.length})
              </button>
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-neuro-primary text-neuro-primary'
                    : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'comparison'
                    ? 'border-neuro-primary text-neuro-primary'
                    : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Comparison
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Recordings Tab */}
            {activeTab === 'recordings' && (
              <div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-neuro-primary"></div>
              <p className="mt-4 text-gray-800">Loading recordings...</p>
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No recordings yet
              </h3>
              <p className="mt-2 text-gray-800">
                Upload your first EEG recording to get started
              </p>
              <button
                onClick={() => router.push(`/projects/${project.id}/upload`)}
                className="mt-6 bg-neuro-primary text-white px-6 py-3 rounded-lg hover:bg-neuro-accent transition-colors font-medium"
              >
                Upload Recording
              </button>
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showEoEcColumn}
                    onChange={(e) => setShowEoEcColumn(e.target.checked)}
                    className="rounded border-gray-300 text-neuro-primary focus:ring-neuro-primary"
                  />
                  Show EO/EC labels column
                </label>
              </div>
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Filename
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Duration
                    </th>
                    {showEoEcColumn && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        EO/EC Labels
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recordings.map((recording) => (
                    <tr key={recording.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {recording.filename}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-800">
                          {formatFileSize(recording.file_size)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-800">
                          {formatDuration(recording.duration_seconds)}
                        </div>
                      </td>
                      {showEoEcColumn && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-800">
                            {recording.eo_start !== null &&
                            recording.ec_start !== null ? (
                              <span className="text-green-600">✓ Labeled</span>
                            ) : (
                              <span className="text-yellow-600">
                                ⚠ Not labeled
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-800">
                          {formatDateStable(recording.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <textarea
                            value={editingNotes[recording.id] ?? ''}
                            onChange={(e) => handleNoteChange(recording.id, e.target.value)}
                            placeholder="Add recording notes..."
                            rows={3}
                            maxLength={2000}
                            className="w-full min-w-[240px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neuro-primary focus:border-transparent text-sm text-gray-900"
                          />
                          <div className="text-xs text-gray-600">
                            {(editingNotes[recording.id] || '').length}/2000
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            className="text-neuro-primary hover:text-neuro-accent font-medium"
                            onClick={() => handleViewAnalysis(recording.id)}
                          >
                            View Analysis
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 font-medium"
                            onClick={() => handleDeleteRecording(recording.id, recording.filename)}
                          >
                            Delete
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            className="text-gray-800 hover:text-gray-900 font-medium disabled:text-gray-400"
                            onClick={() => handleSaveNotes(recording.id)}
                            disabled={savingNoteId === recording.id}
                          >
                            {savingNoteId === recording.id ? 'Saving...' : 'Save Notes'}
                          </button>
                          {notesStatus[recording.id] && (
                            <span
                              className={`text-xs ${
                                notesStatus[recording.id] === 'Saved'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {notesStatus[recording.id]}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-2xl font-bold text-neuro-dark mb-4">
                  Project Overview
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Project Details
                    </h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Name</dt>
                        <dd className="text-sm text-gray-900">{project.name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Created</dt>
                        <dd className="text-sm text-gray-900">
                          {formatDateStable(project.created_at)}
                        </dd>
                      </div>
                      {project.description && (
                        <div className="md:col-span-2">
                          <dt className="text-sm font-medium text-gray-700">Description</dt>
                          <dd className="text-sm text-gray-900">{project.description}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Statistics
                    </h3>
                    <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Total Recordings</dt>
                        <dd className="text-2xl font-bold text-neuro-primary">{recordings.length}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Total Duration</dt>
                        <dd className="text-2xl font-bold text-neuro-primary">
                          {formatDuration(
                            recordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0)
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-700">Total Size</dt>
                        <dd className="text-2xl font-bold text-neuro-primary">
                          {formatFileSize(
                            recordings.reduce((sum, r) => sum + r.file_size, 0)
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {/* Comparison Tab */}
            {activeTab === 'comparison' && (
              <ComparisonView projectId={project.id} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
