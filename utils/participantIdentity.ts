export interface ParticipantRecord {
  id: string;
  name: string;
}

export interface DisplayParticipant extends ParticipantRecord {
  accent: {
    bg: string;
    border: string;
    text: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
  };
  duplicateIndex: number | null;
  duplicateTotal: number;
  isCurrentUser: boolean;
  displayLabel: string;
  shortLabel: string;
}

const DUPLICATE_ACCENTS = [
  {
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/40',
    text: 'text-sky-300',
    bgColor: 'rgba(14, 165, 233, 0.18)',
    borderColor: 'rgba(56, 189, 248, 0.5)',
    textColor: '#bae6fd',
  },
  {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    bgColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(52, 211, 153, 0.5)',
    textColor: '#a7f3d0',
  },
  {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    bgColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.5)',
    textColor: '#fde68a',
  },
  {
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-300',
    bgColor: 'rgba(244, 63, 94, 0.18)',
    borderColor: 'rgba(251, 113, 133, 0.5)',
    textColor: '#fecdd3',
  },
  {
    bg: 'bg-violet-500/15',
    border: 'border-violet-500/40',
    text: 'text-violet-300',
    bgColor: 'rgba(139, 92, 246, 0.18)',
    borderColor: 'rgba(167, 139, 250, 0.5)',
    textColor: '#ddd6fe',
  },
  {
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/40',
    text: 'text-cyan-300',
    bgColor: 'rgba(6, 182, 212, 0.18)',
    borderColor: 'rgba(34, 211, 238, 0.5)',
    textColor: '#a5f3fc',
  },
];

const DEFAULT_ACCENT = {
  bg: 'bg-zinc-700/40',
  border: 'border-zinc-600/60',
  text: 'text-zinc-200',
  bgColor: 'rgba(63, 63, 70, 0.4)',
  borderColor: 'rgba(113, 113, 122, 0.6)',
  textColor: '#e4e4e7',
};

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return '?';

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function annotateParticipants(
  participants: ParticipantRecord[],
  currentUid?: string | null
): DisplayParticipant[] {
  const sorted = [...participants].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (nameCompare !== 0) return nameCompare;

    if (a.id === currentUid) return -1;
    if (b.id === currentUid) return 1;
    return a.id.localeCompare(b.id);
  });

  const duplicateCounts = sorted.reduce<Record<string, number>>((acc, participant) => {
    const key = normalizeName(participant.name);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const duplicateSeen: Record<string, number> = {};

  return sorted.map((participant) => {
    const key = normalizeName(participant.name);
    const duplicateTotal = duplicateCounts[key] ?? 1;
    const isCurrentUser = participant.id === currentUid;

    if (duplicateTotal === 1) {
      return {
        ...participant,
        accent: DEFAULT_ACCENT,
        duplicateIndex: null,
        duplicateTotal,
        isCurrentUser,
        displayLabel: participant.name,
        shortLabel: getInitials(participant.name),
      };
    }

    duplicateSeen[key] = (duplicateSeen[key] ?? 0) + 1;
    const duplicateIndex = duplicateSeen[key];
    const accent = DUPLICATE_ACCENTS[(duplicateIndex - 1) % DUPLICATE_ACCENTS.length];

    return {
      ...participant,
      accent,
      duplicateIndex,
      duplicateTotal,
      isCurrentUser,
      displayLabel: `${participant.name} ${duplicateIndex}`,
      shortLabel: `${duplicateIndex}`,
    };
  });
}
