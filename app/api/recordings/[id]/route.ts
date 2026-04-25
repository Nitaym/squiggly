import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabaseClient } from '@/lib/db';
import { getStorageClient } from '@/lib/storage';
import { checkProjectPermission } from '@/lib/rbac';

interface RecordingData {
  id: string;
  project_id: string;
  file_path: string | null;
}

interface AnalysisData {
  id: string;
}

interface UpdateRecordingBody {
  notes?: string | null;
}

// PATCH /api/recordings/[id] - Update recording metadata
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recordingId = params.id;
    const body = await request.json() as UpdateRecordingBody;

    if (!Object.prototype.hasOwnProperty.call(body, 'notes')) {
      return NextResponse.json(
        { error: 'No updatable fields provided' },
        { status: 400 }
      );
    }

    const rawNotes = body.notes;
    if (rawNotes !== null && rawNotes !== undefined && typeof rawNotes !== 'string') {
      return NextResponse.json(
        { error: 'notes must be a string or null' },
        { status: 400 }
      );
    }

    const normalizedNotes =
      rawNotes === null || rawNotes === undefined
        ? null
        : rawNotes.trim() === ''
          ? null
          : rawNotes.trim();

    if (normalizedNotes && normalizedNotes.length > 2000) {
      return NextResponse.json(
        { error: 'notes must be 2000 characters or less' },
        { status: 400 }
      );
    }

    const db = getDatabaseClient();

    const { data: recording, error: fetchError } = await db
      .from('recordings')
      .select('id, project_id')
      .eq('id', recordingId)
      .single();

    const typedRecording = recording as Pick<RecordingData, 'id' | 'project_id'> | null;
    if (fetchError || !typedRecording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    const hasPermission = await checkProjectPermission(
      typedRecording.project_id,
      user.id,
      'recording:update'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: updatedRecording, error: updateError } = await db
      .from('recordings')
      .update({ notes: normalizedNotes })
      .eq('id', recordingId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating recording:', updateError);
      return NextResponse.json(
        { error: 'Failed to update recording' },
        { status: 500 }
      );
    }

    return NextResponse.json({ recording: updatedRecording });
  } catch (error) {
    console.error('Error in PATCH /api/recordings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/recordings/[id] - Delete a recording
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recordingId = params.id;
    const db = getDatabaseClient();
    const storage = getStorageClient();

    // Fetch recording to get project_id and file_path
    const { data: recording, error: fetchError } = await db
      .from('recordings')
      .select('id, project_id, file_path')
      .eq('id', recordingId)
      .single();

    const typedRecording = recording as RecordingData | null;

    if (fetchError || !typedRecording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Check permission
    const hasPermission = await checkProjectPermission(
      typedRecording.project_id,
      user.id,
      'recording:delete'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete associated analyses first
    const { data: analyses } = await db
      .from('analyses')
      .select('id')
      .eq('recording_id', recordingId)
      .execute();

    const typedAnalyses = analyses as AnalysisData[] | null;

    if (typedAnalyses && typedAnalyses.length > 0) {
      // Delete visual assets from storage for each analysis
      for (const analysis of typedAnalyses) {
        const analysisId = analysis.id;
        try {
          const files = await storage.list('visuals', analysisId);

          if (files && files.length > 0) {
            const filePaths = files.map(f => `${analysisId}/${f.name}`);
            await storage.remove('visuals', filePaths);
          }
        } catch (storageError) {
          console.error(`Error deleting visuals for analysis ${analysisId}:`, storageError);
          // Continue anyway
        }
      }

      // Delete analyses
      for (const analysis of typedAnalyses) {
        await db.from('analyses').delete().eq('id', analysis.id).execute();
      }
    }

    // Delete EDF file from storage
    if (typedRecording.file_path) {
      try {
        const { error: storageError } = await storage.remove(
          'recordings',
          [typedRecording.file_path]
        );

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // Continue anyway - we still want to delete the DB record
        }
      } catch (storageError) {
        console.error('Error deleting file from storage:', storageError);
      }
    }

    // Delete recording from database
    const { error: deleteError } = await db
      .from('recordings')
      .delete()
      .eq('id', recordingId)
      .execute();

    if (deleteError) {
      console.error('Error deleting recording:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete recording' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/recordings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
