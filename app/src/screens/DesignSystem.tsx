// The primitives in isolation (replica-design step 4).
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, Chip, Empty, Field, Header, IconButton, Page, SectionTitle, Segmented, Sheet, Stat, Toggle, inputCls, toast, confirmDialog } from '../components/ui';
import { Chart, Sparkline } from '../components/Chart';
import { BodyMap } from '../components/BodyMap';

const COLORS = ['bg', 'surface', 'surface-2', 'border', 'border-input', 'text', 'muted', 'accent', 'on-accent', 'accent-soft', 'danger', 'success', 'success-soft', 'warning'];

export default function DesignSystem() {
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [sheet, setSheet] = useState(false);
  const now = Date.now() / 1000;
  return (
    <>
      <Header title="Design system" back />
      <Page>
        <SectionTitle>Colour roles</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((c) => <div key={c} className="text-center text-[11px]"><div className="mb-1 h-10 rounded-md border border-border" style={{ background: `rgb(var(--${c}))` }} />{c}</div>)}
        </div>
        <SectionTitle>Type</SectionTitle>
        <p className="text-display">40 Display</p><p className="text-xl">28 Title</p><p className="text-lg">20 Heading</p><p className="text-base">16 Body</p><p className="text-sm text-muted">14 Secondary</p><p className="text-xs">12 Caption</p>
        <SectionTitle>Buttons</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button>
          <Button variant="primary" loading>Saving</Button><Button disabled>Disabled</Button><Button size="sm"><Plus size={16} />Small</Button><Button size="lg" variant="primary">Large</Button>
          <IconButton label="Delete"><Trash2 size={20} /></IconButton>
        </div>
        <SectionTitle>Inputs</SectionTitle>
        <div className="space-y-3">
          <Field label="Text field" hint="Hint text"><input className={inputCls} placeholder="Placeholder" /></Field>
          <Segmented label="Demo" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }]} />
          <Toggle label="Toggle" hint="With a hint" checked={on} onChange={setOn} />
          <div className="flex gap-2"><Chip on>On</Chip><Chip>Off</Chip></div>
        </div>
        <SectionTitle>Feedback</SectionTitle>
        <div className="flex flex-wrap gap-2"><Button onClick={() => toast('Saved', { label: 'Undo', run: () => {} })}>Toast</Button><Button onClick={() => confirmDialog({ title: 'Confirm?', body: 'Body text', ok: 'Delete', danger: true })}>Confirm</Button><Button onClick={() => setSheet(true)}>Sheet</Button></div>
        <SectionTitle>Data</SectionTitle>
        <div className="flex gap-2"><Stat label="Stat" value="1,234" sub="sub" /><Stat label="Spark" value={<Sparkline values={[3, 5, 4, 6, 8, 7, 9]} />} /></div>
        <Card className="mt-2 p-3"><Chart x={[0, 1, 2, 3, 4, 5].map((i) => now - (5 - i) * 7 * 864e2 * 10)} y={[60, 62.5, 62.5, 65, 67.5, 70]} label="Demo chart" /></Card>
        <Card className="mt-2"><BodyMap worked={new Map([['chest', 3], ['triceps', 1.5], ['quads', 2]])} /></Card>
        <div className="mt-2"><Empty title="Empty state" body="Explains what goes here and how to fill it." action={<Button variant="primary">Action</Button>} /></div>
      </Page>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Bottom sheet" footer={<Button variant="primary" block onClick={() => setSheet(false)}>Done</Button>}><p>Sheet content. Escape or tap outside to close.</p></Sheet>
    </>
  );
}
