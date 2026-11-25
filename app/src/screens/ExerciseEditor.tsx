// S19 as a page (from Settings → Exercises, exercise detail, or the create menu)
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import * as repo from '../data/repo';
import { Button, Header, Page, confirmDialog, toast } from '../components/ui';
import { ExerciseFields, useExerciseDraft } from '../components/ExerciseForm';

export default function ExerciseEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const draft = useExerciseDraft(id, params.get('name') ?? '');
  const save = async () => {
    const saved = await draft.save();
    if (!saved) return;
    toast(id ? 'Saved' : 'Exercise created');
    if (id) nav(-1); else nav(`/exercise/${saved.id}`, { replace: true });
  };
  return (
    <>
      <Header title={id ? 'Edit exercise' : 'New exercise'} back right={<Button size="sm" variant="primary" onClick={save}>Save</Button>} />
      <Page>
        <ExerciseFields draft={draft} autoFocus={!id} />
        {id && !draft.builtIn ? (
          <Button variant="ghost" className="mt-8 text-danger" onClick={async () => {
            if (!(await confirmDialog({ title: 'Delete this exercise?', body: 'If it’s in your history it will be hidden instead, so your charts stay intact.', ok: 'Delete', danger: true }))) return;
            const r = await repo.deleteExercise(id); toast(r === 'archived' ? 'Hidden (it’s in your history)' : 'Deleted'); nav('/settings/exercises', { replace: true });
          }}><Trash2 size={16} />Delete exercise</Button>
        ) : null}
      </Page>
    </>
  );
}
