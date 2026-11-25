"""Build src/data/library.json: the big exercise library loaded on first run (and on library upgrades).

Sources:
  1. scripts/vendor/gymdeck-exercises.json: open exercise library by Achref Thamri, MIT licence
     (scripts/vendor/gymdeck-exercises-LICENSE.txt). 498 exercises with steps, muscles, equipment.
  2. EXTRA below: our own list of popular movements the open library lacks (machines, strongman,
     Olympic lifts, cardio, mobility). Names are generic; no text copied from anywhere.
Exercises already in the core seed (src/data/seed.ts) are skipped, matched by name or alias.
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SMALL = {'with', 'and', 'of', 'the', 'to', 'on', 'off', 'a', 'in', 'from', 'behind', 'for', 'or'}

def title(name):
    words = name.strip().split(' ')
    out = []
    for i, w in enumerate(words):
        if i and w.lower() in SMALL: out.append(w.lower())
        elif w[:1].islower(): out.append(w[:1].upper() + w[1:])
        else: out.append(w)
    return ' '.join(out)

def norm(s):
    words = re.findall(r'[a-z0-9]+', s.lower().replace('pushup', 'push up').replace('pullup', 'pull up').replace('situp', 'sit up'))
    out = []
    for w in words:
        if w in ('the', 'a', 'with', 'machine') : continue
        if w.endswith('sses'): w = w[:-2]          # presses -> press
        elif w.endswith('ss'): pass                  # press
        elif len(w) > 3 and w.endswith('s'): w = w[:-1]  # raises -> raise, lunges -> lunge
        out.append(w)
    return ''.join(out)

def slug(s):
    return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', s.lower()))

# ---------- names already in the core seed ----------
seed_src = (ROOT / 'src/data/seed.ts').read_text()
core = set()
for m in re.finditer(r"\[\s*'((?:[^'\\]|\\.)*)'|\[\s*\"([^\"]+)\"", seed_src):
    core.add(norm(m.group(1) or m.group(2)))
for m in re.finditer(r"\[('[^\]]*')\]\],?$", seed_src, re.M):
    for a in re.findall(r"'([^']+)'", m.group(1)): core.add(norm(a))

# ---------- mapping helpers ----------
def has(n, *ks): return any(k in n for k in ks)

def refine(coarse, n):
    if coarse == 'shoulders':
        if has(n, 'rear delt', 'reverse fl', 'face pull', 'rear lateral', 'back fly', 'rotation', 'car driver', 'cuban', 'halo'): return 'rear_delts'
        if has(n, 'lateral', 'side raise', 'deltoid raise', 'upright row', 'iron cross', 'scaption'): return 'side_delts'
        return 'front_delts'
    if coarse == 'back':
        if has(n, 'shrug'): return 'traps'
        if has(n, 'deadlift', 'rack pull', 'good morning', 'hyperextension', 'back extension', 'superman'): return 'lower_back'
        if has(n, 'pulldown', 'pull-up', 'pullup', 'pull up', 'chin', 'pullover', 'straight-arm', 'straight arm'): return 'lats'
        if has(n, 'row', 'pull'): return 'upper_back'
        return 'lats'
    if coarse == 'abs':
        return 'obliques' if has(n, 'oblique', 'twist', 'side', 'woodchop', 'wood chop', 'pallof', 'windmill', 'lift', 'russian') else 'abs'
    if coarse == 'biceps' and has(n, 'hammer', 'reverse', 'zottman', 'wrist'): return 'forearms'
    return {'shoulders': 'front_delts', 'back': 'lats'}.get(coarse, coarse)

LOWER = {'quads', 'glutes', 'hamstrings', 'calves', 'adductors', 'abductors'}
CORE = {'abs', 'obliques'}

def pattern(n, iso, prim):
    if has(n, 'lunge', 'split', 'step-up', 'step up'): return 'lunge'
    if has(n, 'squat'): return 'squat'
    if has(n, 'deadlift', 'good morning', 'hip thrust', 'bridge', 'swing', 'hyperextension', 'rdl', 'pull-through', 'pull through', 'clean', 'snatch'): return 'hinge'
    if has(n, 'carry', 'walk'): return 'carry'
    if has(n, 'pulldown', 'pull-up', 'pullup', 'chin'): return 'vertical_pull'
    if has(n, 'row') and not has(n, 'upright'): return 'horizontal_pull'
    if has(n, 'press', 'push-up', 'pushup', 'push up', 'dip', 'jerk'):
        return 'vertical_push' if has(n, 'overhead', 'shoulder', 'military', 'jerk', 'push press', 'arnold', 'pike', 'handstand', 'z press') else 'horizontal_push'
    if prim in CORE: return 'core'
    return 'isolation' if iso else ('hinge' if prim in LOWER else 'horizontal_push')

EQ = {'smith-machine': ['smith'], 'pullup-bar': ['pullup_bar'], 'lat-pulldown': ['machine', 'cable'], 'leg-press': ['machine'],
      'chest-press-machine': ['machine'], 'leg-curl': ['machine'], 'seated-row-machine': ['machine'], 'shoulder-press-machine': ['machine'],
      'pec-deck': ['machine'], 'calf-raise-machine': ['machine'], 'leg-extension': ['machine'], 'hip-thrust-machine': ['machine']}

def equipment(raw, n):
    out = []
    for e in raw:
        for x in EQ.get(e, [e]):
            if x not in out: out.append(x)
    if has(n, 'ez bar', 'ez-bar', 'ez curl') and 'ez_bar' not in out: out = ['ez_bar' if x == 'barbell' else x for x in out] or ['ez_bar']
    if has(n, 'trap bar', 'hex bar') : out = ['trap_bar']
    if has(n, 'leverage', 'machine') and 'machine' not in out: out.append('machine')
    return out or ['bodyweight']

TIMED = ('plank', 'hold', 'wall sit', 'hang', 'carry', 'walk')

def build_open():
    data = json.loads((ROOT / 'scripts/vendor/gymdeck-exercises.json').read_text())
    out, seen = [], set(core)
    for e in data:
        name = title(e['name'])
        k = norm(name)
        if k in seen: continue
        seen.add(k)
        n = name.lower()
        prim = refine(e['muscles']['primary'], n)
        sec = []
        for s in e['muscles']['secondary']:
            r = refine(s, n)
            if r != prim and r not in sec: sec.append(r)
        if prim == 'upper_back' and 'lats' not in sec: sec.append('lats')
        iso = e['mechanic'] == 'isolation'
        typ = 'core' if prim in CORE else ('isolation_' if iso else 'compound_') + ('lower' if prim in LOWER else 'upper')
        eq = equipment(e['equipment'], n)
        bw_only = eq == ['bodyweight'] or set(eq) <= {'bodyweight', 'pullup_bar', 'bench'}
        bw = 0
        if bw_only:
            bw = 1.0 if has(n, 'pull-up', 'pullup', 'chin', 'dip') else 0.65 if has(n, 'push-up', 'pushup', 'push up') else 0.6 if not iso else 0.3
        out.append(dict(id='g-' + slug(name), name=name, type=typ, pattern=pattern(n, iso, prim), primary=[prim], secondary=sec,
                        equipment=eq, laterality='unilateral' if has(n, 'one-arm', 'single-arm', 'one arm', 'single arm', 'one-leg', 'single-leg', 'one leg', 'single leg', 'alternating') else 'bilateral',
                        bw=bw, metric='time' if has(n, *TIMED) else 'weight_reps', steps=e.get('steps', [])))
    return out, seen

# ---------- our extra list: name, type, pattern, primary, secondary, equipment, [laterality, bw, metric, aliases] ----------
CU, CL, IU, IL, CO, CA = 'compound_upper', 'compound_lower', 'isolation_upper', 'isolation_lower', 'core', 'cardio'
EXTRA = [
 # chest
 ('Decline Barbell Bench Press', CU, 'horizontal_push', ['chest'], ['triceps'], ['barbell', 'bench']),
 ('Decline Dumbbell Press', CU, 'horizontal_push', ['chest'], ['triceps'], ['dumbbell', 'bench']),
 ('Incline Smith Machine Press', CU, 'horizontal_push', ['chest', 'front_delts'], ['triceps'], ['smith', 'bench']),
 ('Incline Machine Chest Press', CU, 'horizontal_push', ['chest', 'front_delts'], ['triceps'], ['machine']),
 ('Hammer Strength Chest Press', CU, 'horizontal_push', ['chest'], ['triceps', 'front_delts'], ['machine'], 'bilateral', 0, 'weight_reps', ['plate loaded chest press', 'iso-lateral chest press']),
 ('Larsen Press', CU, 'horizontal_push', ['chest'], ['triceps'], ['barbell', 'bench']),
 ('Spoto Press', CU, 'horizontal_push', ['chest'], ['triceps'], ['barbell', 'bench']),
 ('Pin Press', CU, 'horizontal_push', ['chest', 'triceps'], [], ['barbell']),
 ('Board Press', CU, 'horizontal_push', ['triceps', 'chest'], [], ['barbell', 'bench']),
 ('Low-to-High Cable Fly', IU, 'isolation', ['chest'], ['front_delts'], ['cable']),
 ('High-to-Low Cable Fly', IU, 'isolation', ['chest'], [], ['cable']),
 ('Incline Cable Fly', IU, 'isolation', ['chest'], ['front_delts'], ['cable', 'bench']),
 ('Svend Press', IU, 'isolation', ['chest'], [], ['dumbbell']),
 ('Deficit Push-Up', CU, 'horizontal_push', ['chest'], ['triceps'], ['bodyweight'], 'bilateral', 0.65),
 ('Weighted Push-Up', CU, 'horizontal_push', ['chest'], ['triceps'], ['bodyweight'], 'bilateral', 0.65),
 ('Ring Push-Up', CU, 'horizontal_push', ['chest'], ['triceps', 'abs'], ['bodyweight'], 'bilateral', 0.65),
 ('Weighted Dip', CU, 'vertical_push', ['chest', 'triceps'], ['front_delts'], ['dip_bars'], 'bilateral', 1),
 ('Assisted Dip Machine', CU, 'vertical_push', ['chest', 'triceps'], [], ['machine']),
 # shoulders
 ('Z Press', CU, 'vertical_push', ['front_delts'], ['triceps', 'abs'], ['barbell']),
 ('Push Press', CU, 'vertical_push', ['front_delts'], ['triceps', 'quads'], ['barbell']),
 ('Behind-the-Neck Press', CU, 'vertical_push', ['front_delts', 'side_delts'], ['triceps'], ['barbell']),
 ('Landmine Press', CU, 'vertical_push', ['front_delts'], ['chest', 'triceps'], ['barbell'], 'unilateral'),
 ('Viking Press', CU, 'vertical_push', ['front_delts'], ['triceps'], ['machine']),
 ('Smith Machine Shoulder Press', CU, 'vertical_push', ['front_delts'], ['triceps'], ['smith', 'bench']),
 ('Lu Raise', IU, 'isolation', ['side_delts', 'front_delts'], [], ['dumbbell']),
 ('Lean-Away Lateral Raise', IU, 'isolation', ['side_delts'], [], ['dumbbell', 'cable'], 'unilateral'),
 ('Y-Raise', IU, 'isolation', ['side_delts', 'traps'], [], ['dumbbell', 'cable']),
 ('Cable Y-Raise', IU, 'isolation', ['side_delts'], ['traps'], ['cable']),
 ('Rear Delt Cable Fly', IU, 'isolation', ['rear_delts'], [], ['cable']),
 ('Machine Rear Delt Row', IU, 'horizontal_pull', ['rear_delts'], ['upper_back'], ['machine']),
 ('Handstand Push-Up', CU, 'vertical_push', ['front_delts'], ['triceps'], ['bodyweight'], 'bilateral', 1),
 ('Pike Push-Up', CU, 'vertical_push', ['front_delts'], ['triceps'], ['bodyweight'], 'bilateral', 0.7),
 # back
 ('Pendlay Row', CU, 'horizontal_pull', ['upper_back', 'lats'], ['rear_delts', 'lower_back'], ['barbell']),
 ('Seal Row', CU, 'horizontal_pull', ['upper_back', 'lats'], ['rear_delts'], ['barbell', 'bench']),
 ('Meadows Row', CU, 'horizontal_pull', ['lats', 'upper_back'], ['rear_delts', 'biceps'], ['barbell'], 'unilateral'),
 ('Kroc Row', CU, 'horizontal_pull', ['lats', 'upper_back'], ['biceps', 'forearms'], ['dumbbell'], 'unilateral'),
 ('Yates Row', CU, 'horizontal_pull', ['upper_back', 'lats'], ['biceps'], ['barbell']),
 ('Helms Row', CU, 'horizontal_pull', ['upper_back'], ['rear_delts'], ['dumbbell', 'bench']),
 ('Iso-Lateral Row Machine', CU, 'horizontal_pull', ['upper_back', 'lats'], ['biceps'], ['machine'], 'both', 0, 'weight_reps', ['hammer strength row', 'plate loaded row']),
 ('Iso-Lateral Pulldown Machine', CU, 'vertical_pull', ['lats'], ['biceps'], ['machine'], 'both', 0, 'weight_reps', ['hammer strength pulldown']),
 ('Wide-Grip Lat Pulldown', CU, 'vertical_pull', ['lats'], ['upper_back', 'biceps'], ['cable', 'machine']),
 ('Neutral-Grip Lat Pulldown', CU, 'vertical_pull', ['lats'], ['biceps'], ['cable', 'machine']),
 ('Single-Arm Lat Pulldown', CU, 'vertical_pull', ['lats'], ['biceps'], ['cable'], 'unilateral'),
 ('Kneeling Lat Pulldown', CU, 'vertical_pull', ['lats'], ['biceps'], ['cable'], 'unilateral'),
 ('Cable Pullover', IU, 'isolation', ['lats'], [], ['cable']),
 ('Dumbbell Pullover', IU, 'isolation', ['lats', 'chest'], [], ['dumbbell', 'bench']),
 ('Neutral-Grip Pull-Up', CU, 'vertical_pull', ['lats'], ['biceps'], ['pullup_bar'], 'bilateral', 1),
 ('Weighted Pull-Up', CU, 'vertical_pull', ['lats'], ['biceps', 'upper_back'], ['pullup_bar'], 'bilateral', 1),
 ('Weighted Chin-Up', CU, 'vertical_pull', ['lats', 'biceps'], [], ['pullup_bar'], 'bilateral', 1),
 ('Muscle-Up', CU, 'vertical_pull', ['lats'], ['triceps', 'chest'], ['pullup_bar'], 'bilateral', 1),
 ('Scapular Pull-Up', IU, 'vertical_pull', ['lats', 'traps'], [], ['pullup_bar'], 'bilateral', 1),
 ('Rack Pull', CL, 'hinge', ['lower_back', 'traps'], ['glutes', 'forearms'], ['barbell']),
 ('Snatch-Grip Deadlift', CL, 'hinge', ['hamstrings', 'upper_back'], ['glutes', 'traps'], ['barbell']),
 ('Deficit Deadlift', CL, 'hinge', ['glutes', 'hamstrings', 'lower_back'], ['quads'], ['barbell']),
 ('Stiff-Leg Deadlift', CL, 'hinge', ['hamstrings'], ['glutes', 'lower_back'], ['barbell']),
 ('Jefferson Curl', IL, 'hinge', ['lower_back', 'hamstrings'], [], ['barbell', 'dumbbell']),
 ('Reverse Hyperextension', IL, 'hinge', ['glutes', 'lower_back'], ['hamstrings'], ['machine']),
 ('Trap Bar Shrug', IU, 'isolation', ['traps'], [], ['trap_bar']),
 ('Smith Machine Shrug', IU, 'isolation', ['traps'], [], ['smith']),
 # arms
 ('Bayesian Cable Curl', IU, 'isolation', ['biceps'], [], ['cable'], 'unilateral'),
 ('Spider Curl', IU, 'isolation', ['biceps'], [], ['dumbbell', 'bench']),
 ('Drag Curl', IU, 'isolation', ['biceps'], [], ['barbell']),
 ('Concentration Curl', IU, 'isolation', ['biceps'], [], ['dumbbell'], 'unilateral'),
 ('Rope Hammer Curl', IU, 'isolation', ['biceps', 'forearms'], [], ['cable']),
 ('Cross-Body Hammer Curl', IU, 'isolation', ['biceps', 'forearms'], [], ['dumbbell'], 'unilateral'),
 ('Reverse Curl', IU, 'isolation', ['forearms'], ['biceps'], ['barbell', 'ez_bar']),
 ('Machine Bicep Curl', IU, 'isolation', ['biceps'], [], ['machine']),
 ('Reverse Wrist Curl', IU, 'isolation', ['forearms'], [], ['dumbbell', 'barbell']),
 ('Wrist Roller', IU, 'isolation', ['forearms'], [], ['bodyweight']),
 ('Dead Hang', IU, 'isolation', ['forearms'], ['lats'], ['pullup_bar'], 'bilateral', 0, 'time'),
 ('JM Press', CU, 'horizontal_push', ['triceps'], ['chest'], ['barbell', 'bench']),
 ('Tate Press', IU, 'isolation', ['triceps'], [], ['dumbbell', 'bench']),
 ('Single-Arm Cable Pushdown', IU, 'isolation', ['triceps'], [], ['cable'], 'unilateral'),
 ('Cable Kickback', IU, 'isolation', ['triceps'], [], ['cable'], 'unilateral'),
 ('Dumbbell Kickback', IU, 'isolation', ['triceps'], [], ['dumbbell'], 'unilateral'),
 ('Machine Triceps Extension', IU, 'isolation', ['triceps'], [], ['machine']),
 ('Triceps Dip Machine', CU, 'vertical_push', ['triceps'], ['chest'], ['machine']),
 ('EZ-Bar Overhead Triceps Extension', IU, 'isolation', ['triceps'], [], ['ez_bar']),
 # legs
 ('Pause Squat', CL, 'squat', ['quads', 'glutes'], ['adductors'], ['barbell']),
 ('Box Squat', CL, 'squat', ['quads', 'glutes'], ['hamstrings'], ['barbell', 'bench']),
 ('Safety Bar Squat', CL, 'squat', ['quads', 'glutes'], ['upper_back'], ['barbell'], 'bilateral', 0, 'weight_reps', ['ssb squat']),
 ('Zercher Squat', CL, 'squat', ['quads', 'glutes'], ['abs', 'upper_back'], ['barbell']),
 ('Belt Squat', CL, 'squat', ['quads', 'glutes'], [], ['machine']),
 ('Pendulum Squat', CL, 'squat', ['quads'], ['glutes'], ['machine']),
 ('V-Squat Machine', CL, 'squat', ['quads'], ['glutes'], ['machine']),
 ('Sissy Squat', IL, 'squat', ['quads'], [], ['bodyweight'], 'bilateral', 0.6),
 ('Pistol Squat', CL, 'squat', ['quads', 'glutes'], [], ['bodyweight'], 'unilateral', 1),
 ('Heels-Elevated Goblet Squat', CL, 'squat', ['quads'], ['glutes'], ['dumbbell', 'kettlebell']),
 ('Single-Leg Leg Press', CL, 'squat', ['quads', 'glutes'], [], ['machine'], 'unilateral'),
 ('Hack Squat Machine Calf Raise', IL, 'isolation', ['calves'], [], ['machine']),
 ('Smith Machine Split Squat', CL, 'lunge', ['quads', 'glutes'], [], ['smith'], 'unilateral'),
 ('Front-Foot-Elevated Split Squat', CL, 'lunge', ['quads', 'glutes'], [], ['dumbbell'], 'unilateral'),
 ('Curtsy Lunge', CL, 'lunge', ['glutes', 'quads'], ['abductors'], ['dumbbell'], 'unilateral'),
 ('Lateral Lunge', CL, 'lunge', ['adductors', 'quads'], ['glutes'], ['dumbbell'], 'unilateral'),
 ('Cossack Squat', CL, 'lunge', ['adductors', 'quads'], ['glutes'], ['bodyweight'], 'unilateral', 0.7),
 ('Hip Thrust Machine', CL, 'hinge', ['glutes'], ['hamstrings'], ['machine']),
 ('Single-Leg Hip Thrust', CL, 'hinge', ['glutes'], ['hamstrings'], ['bodyweight', 'bench'], 'unilateral', 0.5),
 ('Smith Machine Hip Thrust', CL, 'hinge', ['glutes'], ['hamstrings'], ['smith', 'bench']),
 ('Cable Glute Kickback', IL, 'isolation', ['glutes'], [], ['cable'], 'unilateral'),
 ('Glute Kickback Machine', IL, 'isolation', ['glutes'], [], ['machine'], 'unilateral'),
 ('Frog Pump', IL, 'hinge', ['glutes'], [], ['bodyweight'], 'bilateral', 0.3),
 ('Banded Lateral Walk', IL, 'isolation', ['abductors', 'glutes'], [], ['band']),
 ('Cable Hip Abduction', IL, 'isolation', ['abductors', 'glutes'], [], ['cable'], 'unilateral'),
 ('Cable Hip Adduction', IL, 'isolation', ['adductors'], [], ['cable'], 'unilateral'),
 ('Copenhagen Plank', CO, 'core', ['adductors', 'obliques'], [], ['bodyweight', 'bench'], 'unilateral', 0, 'time'),
 ('Standing Leg Curl', IL, 'isolation', ['hamstrings'], [], ['machine'], 'unilateral'),
 ('Glute-Ham Raise', IL, 'hinge', ['hamstrings', 'glutes'], [], ['machine'], 'bilateral', 0.6, 'weight_reps', ['ghr']),
 ('Single-Leg Leg Extension', IL, 'isolation', ['quads'], [], ['machine'], 'unilateral'),
 ('Tibialis Raise', IL, 'isolation', ['calves'], [], ['bodyweight'], 'bilateral', 0.3, 'weight_reps', ['tib raise']),
 ('Donkey Calf Raise', IL, 'isolation', ['calves'], [], ['machine']),
 ('Smith Machine Calf Raise', IL, 'isolation', ['calves'], [], ['smith']),
 # Olympic & power
 ('Power Snatch', CL, 'hinge', ['glutes', 'quads'], ['traps', 'front_delts'], ['barbell']),
 ('Hang Clean', CL, 'hinge', ['glutes', 'hamstrings'], ['traps', 'quads'], ['barbell']),
 ('Hang Power Clean', CL, 'hinge', ['glutes', 'hamstrings'], ['traps'], ['barbell']),
 ('Clean and Jerk', CL, 'hinge', ['glutes', 'quads'], ['front_delts', 'triceps', 'traps'], ['barbell']),
 ('Squat Clean', CL, 'squat', ['quads', 'glutes'], ['traps'], ['barbell']),
 ('Split Jerk', CU, 'vertical_push', ['front_delts'], ['quads', 'triceps'], ['barbell']),
 ('Overhead Squat', CL, 'squat', ['quads', 'glutes'], ['front_delts', 'abs'], ['barbell']),
 ('Thruster', CL, 'squat', ['quads', 'front_delts'], ['glutes', 'triceps'], ['barbell', 'dumbbell']),
 ('Box Jump', CL, 'squat', ['quads', 'glutes'], ['calves'], ['bodyweight'], 'bilateral', 0),
 ('Broad Jump', CL, 'squat', ['quads', 'glutes'], ['calves'], ['bodyweight'], 'bilateral', 0),
 ('Medicine Ball Slam', CO, 'core', ['abs'], ['lats', 'front_delts'], ['bodyweight']),
 ('Wall Ball', CL, 'squat', ['quads', 'front_delts'], ['glutes'], ['bodyweight']),
 # strongman
 ('Yoke Walk', CL, 'carry', ['quads', 'traps'], ['abs'], ['machine'], 'bilateral', 0, 'time'),
 ('Sandbag Carry', CL, 'carry', ['abs', 'upper_back'], ['quads'], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Suitcase Carry', CO, 'carry', ['obliques', 'forearms'], ['traps'], ['dumbbell', 'kettlebell'], 'unilateral', 0, 'time'),
 ('Atlas Stone Lift', CL, 'hinge', ['glutes', 'lower_back'], ['biceps', 'upper_back'], ['bodyweight']),
 ('Log Press', CU, 'vertical_push', ['front_delts'], ['triceps', 'chest'], ['barbell']),
 ('Tire Flip', CL, 'hinge', ['glutes', 'hamstrings'], ['chest', 'front_delts'], ['bodyweight']),
 ('Sled Push', CL, 'carry', ['quads', 'glutes'], ['calves'], ['machine'], 'bilateral', 0, 'time'),
 ('Sled Pull', CL, 'carry', ['hamstrings', 'glutes'], ['upper_back'], ['machine'], 'bilateral', 0, 'time'),
 # core
 ('Hollow Body Hold', CO, 'core', ['abs'], [], ['bodyweight'], 'bilateral', 0, 'time'),
 ('L-Sit', CO, 'core', ['abs'], ['triceps'], ['bodyweight', 'dip_bars'], 'bilateral', 0, 'time'),
 ('Toes-to-Bar', CO, 'core', ['abs'], ['lats'], ['pullup_bar'], 'bilateral', 0.35),
 ('Dragon Flag', CO, 'core', ['abs'], [], ['bench'], 'bilateral', 0.5),
 ('Ab Crunch Machine', CO, 'core', ['abs'], [], ['machine']),
 ('Cable Woodchop', CO, 'core', ['obliques'], ['abs'], ['cable'], 'unilateral'),
 ('Bird Dog', CO, 'core', ['lower_back', 'abs'], ['glutes'], ['bodyweight'], 'unilateral'),
 ('Bicycle Crunch', CO, 'core', ['abs', 'obliques'], [], ['bodyweight'], 'bilateral', 0.25),
 ('Reverse Crunch', CO, 'core', ['abs'], [], ['bodyweight', 'bench'], 'bilateral', 0.25),
 ('Weighted Plank', CO, 'core', ['abs'], ['obliques'], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Stir the Pot', CO, 'core', ['abs'], ['obliques'], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Landmine Rotation', CO, 'core', ['obliques'], ['front_delts'], ['barbell']),
 ('Mountain Climber', CO, 'core', ['abs'], ['front_delts', 'quads'], ['bodyweight'], 'bilateral', 0, 'time'),
 # cardio & conditioning (time tracked; reps = seconds)
 ('Treadmill Run', CA, 'carry', ['quads', 'calves'], ['hamstrings', 'glutes'], ['machine'], 'bilateral', 0, 'time', ['running']),
 ('Outdoor Run', CA, 'carry', ['quads', 'calves'], ['hamstrings', 'glutes'], ['bodyweight'], 'bilateral', 0, 'time', ['jog', 'running']),
 ('Incline Treadmill Walk', CA, 'carry', ['glutes', 'calves'], ['hamstrings'], ['machine'], 'bilateral', 0, 'time'),
 ('Walking', CA, 'carry', ['calves'], ['quads'], ['bodyweight'], 'bilateral', 0, 'time', ['walk']),
 ('Rowing Machine', CA, 'horizontal_pull', ['upper_back', 'quads'], ['lats', 'hamstrings'], ['machine'], 'bilateral', 0, 'time', ['erg', 'rower']),
 ('Stationary Bike', CA, 'squat', ['quads'], ['glutes', 'calves'], ['machine'], 'bilateral', 0, 'time', ['cycling', 'spin bike']),
 ('Air Bike', CA, 'squat', ['quads'], ['front_delts', 'glutes'], ['machine'], 'bilateral', 0, 'time', ['assault bike', 'fan bike']),
 ('Elliptical', CA, 'carry', ['quads'], ['glutes'], ['machine'], 'bilateral', 0, 'time', ['cross trainer']),
 ('Stair Climber', CA, 'lunge', ['glutes', 'quads'], ['calves'], ['machine'], 'bilateral', 0, 'time', ['stairmaster', 'stair master']),
 ('Ski Erg', CA, 'vertical_pull', ['lats', 'triceps'], ['abs'], ['machine'], 'bilateral', 0, 'time'),
 ('Jump Rope', CA, 'carry', ['calves'], ['quads'], ['bodyweight'], 'bilateral', 0, 'time', ['skipping']),
 ('Swimming', CA, 'carry', ['lats', 'front_delts'], ['abs'], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Battle Ropes', CA, 'carry', ['front_delts'], ['abs', 'forearms'], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Burpee', CA, 'squat', ['quads', 'chest'], ['abs', 'front_delts'], ['bodyweight'], 'bilateral', 0.6),
 ('Jumping Jacks', CA, 'carry', ['calves'], ['side_delts'], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Hiking', CA, 'carry', ['glutes', 'quads'], ['calves'], ['bodyweight'], 'bilateral', 0, 'time'),
 # mobility & prehab
 ('Band Face Pull', IU, 'horizontal_pull', ['rear_delts'], ['upper_back'], ['band']),
 ('Band Dislocates', IU, 'isolation', ['rear_delts'], ['front_delts'], ['band'], 'bilateral', 0, 'weight_reps', ['shoulder dislocates', 'pass-throughs']),
 ('Cable External Rotation', IU, 'isolation', ['rear_delts'], [], ['cable'], 'unilateral'),
 ('Prone Y-T-W Raise', IU, 'isolation', ['rear_delts', 'traps'], [], ['dumbbell', 'bench']),
 ('Wall Slide', IU, 'isolation', ['traps', 'rear_delts'], [], ['bodyweight']),
 ('Deep Squat Hold', IL, 'squat', ['quads', 'adductors'], [], ['bodyweight'], 'bilateral', 0, 'time'),
 ('90/90 Hip Switch', IL, 'isolation', ['glutes', 'adductors'], [], ['bodyweight']),
 ('Hip Flexor Stretch', IL, 'isolation', ['quads'], [], ['bodyweight'], 'unilateral', 0, 'time'),
 ('Hamstring Stretch', IL, 'isolation', ['hamstrings'], [], ['bodyweight'], 'bilateral', 0, 'time'),
 ('Cat-Cow', CO, 'core', ['lower_back'], ['abs'], ['bodyweight']),
 ('World’s Greatest Stretch', CL, 'lunge', ['glutes', 'hamstrings'], ['adductors'], ['bodyweight'], 'unilateral'),
]

def build_extra(seen):
    out = []
    for row in EXTRA:
        name, typ, pat, prim, sec, eq, *rest = row
        lat, bw, metric, aliases = (rest + ['bilateral', 0, 'weight_reps', []][len(rest):])[:4]
        k = norm(name)
        if k in seen: continue
        seen.add(k)
        out.append(dict(id='e-' + slug(name), name=name, type=typ, pattern=pat, primary=prim, secondary=sec, equipment=eq,
                        laterality=lat, bw=bw, metric=metric, aliases=aliases))
    return out

if __name__ == '__main__':
    lib, seen = build_open()
    extra = build_extra(seen)
    allx = sorted(lib + extra, key=lambda e: e['name'].lower())
    ids = [e['id'] for e in allx]
    assert len(ids) == len(set(ids)), 'duplicate ids'
    (ROOT / 'src/data/library.json').write_text(json.dumps(allx, ensure_ascii=False, separators=(',', ':')))
    print(f'core seed names: {len(core)}; open library: {len(lib)}; extra: {len(extra)}; total library: {len(allx)}')
