-- Add editable notes field for each EEG recording.
-- Idempotent: safe to run multiple times.

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Supabase only: add an UPDATE RLS policy so owners and collaborators can
-- mutate recording metadata (notes, etc.). Docker mode skips RLS entirely
-- and is unaffected by this block.
DROP POLICY IF EXISTS "Owners and collaborators can update recordings" ON recordings;
CREATE POLICY "Owners and collaborators can update recordings"
  ON recordings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = recordings.project_id
      AND (
        projects.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('owner', 'collaborator')
        )
      )
    )
  );
