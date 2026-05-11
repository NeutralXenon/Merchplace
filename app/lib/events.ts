export type EventDrop = {
  slug: string;
  name: string;
  shortName: string;
  location: string;
  year: string;
  launchStatus: 'launch-drop' | 'seeded' | 'catalog';
  supplyGoal: number;
  summary: string;
  sellerPrompt: string;
  curationStandard: string;
  wantedInventory: string[];
  sellerSlots: string[];
};

export type SupplyReadiness = {
  current: number;
  goal: number;
  remaining: number;
  percent: number;
};

export const EVENT_DROPS: EventDrop[] = [
  {
    slug: 'breakpoint-2025',
    name: 'Breakpoint 2025',
    shortName: 'Breakpoint',
    location: 'Abu Dhabi',
    year: '2025',
    launchStatus: 'launch-drop',
    supplyGoal: 12,
    summary: 'Conference pieces, team drops, and venue merch from the next Breakpoint run.',
    sellerPrompt: 'Seed the Breakpoint 2025 shelf with shirts, caps, badges, bags, or staff-only pieces.',
    curationStandard:
      'Prioritize event-marked pieces with clear condition notes, visible logos or tags, and shipping-ready sellers.',
    wantedInventory: [
      'Event hoodie or crewneck',
      'Staff tee or speaker shirt',
      'Badge, lanyard, or wristband',
      'Cap, tote, or backpack',
      'Sticker pack or sponsor bundle',
      'Team-only merch with provenance notes',
    ],
    sellerSlots: [
      'Collector with unworn apparel',
      'Builder team with sponsor merch',
      'Attendee with badge and accessory bundle',
    ],
  },
  {
    slug: 'colosseum-2025',
    name: 'Colosseum 2025',
    shortName: 'Colosseum',
    location: 'Online',
    year: '2025',
    launchStatus: 'seeded',
    supplyGoal: 8,
    summary: 'Hackathon artifacts, winner gear, and builder memorabilia from Colosseum teams.',
    sellerPrompt: 'List hackathon merch, team gear, winner caps, or builder swag tied to Colosseum 2025.',
    curationStandard:
      'Favor team-linked artifacts with project context, winner/proof notes, and clean shipping expectations.',
    wantedInventory: ['Winner cap', 'Team shirt', 'Sticker pack', 'Demo day badge'],
    sellerSlots: ['Winning team member', 'Hackathon organizer', 'Builder with team merch'],
  },
  {
    slug: 'hacker-house-tokyo',
    name: 'Hacker House Tokyo',
    shortName: 'Tokyo House',
    location: 'Tokyo',
    year: '2025',
    launchStatus: 'catalog',
    supplyGoal: 6,
    summary: 'Local hacker house shirts, stickers, and meetup pieces with a clear event trail.',
    sellerPrompt: 'Add Tokyo Hacker House pieces with visible event details, tags, or venue marks.',
    curationStandard:
      'Keep the shelf focused on local event merch with enough detail for collectors to verify origin.',
    wantedInventory: ['Hacker house tee', 'Venue sticker', 'Workshop badge', 'Local meetup cap'],
    sellerSlots: ['Local attendee', 'Workshop host', 'Community organizer'],
  },
  {
    slug: 'superteam-summit',
    name: 'Superteam Summit',
    shortName: 'Superteam',
    location: 'Global',
    year: '2025',
    launchStatus: 'catalog',
    supplyGoal: 6,
    summary: 'Contributor gear and summit merch from the Superteam network.',
    sellerPrompt: 'List contributor backpacks, tees, hats, or summit-only drops from Superteam events.',
    curationStandard:
      'Show contributor context, region or summit source, and clear item condition for each piece.',
    wantedInventory: ['Contributor backpack', 'Summit tee', 'Regional cap', 'Contributor sticker pack'],
    sellerSlots: ['Superteam contributor', 'Summit attendee', 'Regional lead'],
  },
  {
    slug: 'phantom-launch',
    name: 'Phantom Launch',
    shortName: 'Phantom',
    location: 'Launch drop',
    year: '2025',
    launchStatus: 'catalog',
    supplyGoal: 5,
    summary: 'Wallet launch artifacts and rare Phantom-branded merch for collectors.',
    sellerPrompt: 'Add Phantom launch socks, stickers, apparel, or limited wallet-community pieces.',
    curationStandard:
      'Treat this as a collectible shelf: clear branding, launch context, condition, and scarcity notes matter.',
    wantedInventory: ['Launch socks', 'Sticker sheet', 'Community tee', 'Limited accessory'],
    sellerSlots: ['Launch collector', 'Wallet community member', 'Event attendee'],
  },
  {
    slug: 'breakpoint-2024',
    name: 'Breakpoint 2024',
    shortName: 'Breakpoint',
    location: 'Singapore',
    year: '2024',
    launchStatus: 'seeded',
    supplyGoal: 8,
    summary: 'Previous-year Breakpoint drops with enough provenance for collectors to compare.',
    sellerPrompt: 'Bring older Breakpoint pieces back into circulation with condition and provenance notes.',
    curationStandard:
      'Older pieces need stronger condition and provenance notes so buyers can compare year-to-year drops.',
    wantedInventory: ['Bomber jacket', 'Conference tee', 'Badge bundle', 'Sponsor tote'],
    sellerSlots: ['Past attendee', 'Speaker or volunteer', 'Collector rotating inventory'],
  },
];

export function getEventDropBySlug(slug: string): EventDrop | undefined {
  return EVENT_DROPS.find((event) => event.slug === slug);
}

export function getEventDropByName(name: string): EventDrop | undefined {
  return EVENT_DROPS.find((event) => event.name === name);
}

export function getEventDropHref(name: string): string | null {
  const event = getEventDropByName(name);
  return event ? `/event/${event.slug}` : null;
}

export function getSupplyReadiness(event: EventDrop, currentInventory: number): SupplyReadiness {
  const goal = Math.max(1, event.supplyGoal);
  const current = Math.max(0, currentInventory);
  const remaining = Math.max(0, goal - current);
  const percent = Math.min(100, Math.round((current / goal) * 100));

  return {
    current,
    goal,
    remaining,
    percent,
  };
}
