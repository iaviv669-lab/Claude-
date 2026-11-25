import { useNavigate } from 'react-router-dom';
import { CalendarRange, Dumbbell, ListPlus, Zap } from 'lucide-react';
import { MenuItem, Sheet, toast } from '../components/ui';
import { saveProgram, startSession } from '../data/repo';

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const go = (to: string) => { onClose(); nav(to); };
  return (
    <Sheet open={open} onClose={onClose} title="Create">
      <MenuItem icon={<Zap size={20} />} hint="Start logging now, add exercises as you go" onClick={async () => { onClose(); await startSession(null, 'Quick workout'); nav('/session'); }}>Quick workout</MenuItem>
      <MenuItem icon={<ListPlus size={20} />} hint="A workout you can repeat" onClick={() => go('/workout/new')}>New workout</MenuItem>
      <MenuItem icon={<CalendarRange size={20} />} hint="A rotation of workouts, e.g. Push / Pull / Legs" onClick={async () => { const id = await saveProgram({ name: 'New program' }); go(`/program/${id}`); toast('Program created'); }}>New program</MenuItem>
      <MenuItem icon={<Dumbbell size={20} />} hint="Add a movement that isn’t in the list" onClick={() => go('/exercise/new')}>New exercise</MenuItem>
    </Sheet>
  );
}
