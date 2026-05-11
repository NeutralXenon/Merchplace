export type ShippingMethod = {
  id: string;
  carrier: string;
  service: string;
  priceMicro: number;
  eta: string;
  note: string;
};

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 'dhl-servicepoint',
    carrier: 'DHL',
    service: 'ServicePoint parcel',
    priceMicro: 4_290_000,
    eta: '2-4 business days',
    note: 'Vinted-style tracked parcel point shipping for hoodies, jackets, bags, and boxed merch.',
  },
  {
    id: 'dpd-pickup',
    carrier: 'DPD',
    service: 'Pickup parcel',
    priceMicro: 3_790_000,
    eta: '2-5 business days',
    note: 'Parcel-shop drop-off for standard tracked packages.',
  },
  {
    id: 'ups-access-point',
    carrier: 'UPS',
    service: 'Access Point',
    priceMicro: 4_490_000,
    eta: '2-5 business days',
    note: 'Tracked Access Point shipping for sturdy parcels and higher-value pieces.',
  },
  {
    id: 'mondial-relay-inpost',
    carrier: 'Mondial Relay / InPost',
    service: 'Pickup point',
    priceMicro: 2_890_000,
    eta: '3-7 business days',
    note: 'Low-cost pickup-point shipping commonly seen in Vinted cross-border flows.',
  },
  {
    id: 'homerr-socialpoint',
    carrier: 'Homerr',
    service: 'SocialPoint',
    priceMicro: 2_890_000,
    eta: '3-7 business days',
    note: 'Community pickup-point shipping for small and medium parcels.',
  },
  {
    id: 'vinted-go-locker',
    carrier: 'Vinted Go',
    service: 'Locker',
    priceMicro: 2_890_000,
    eta: '2-5 business days',
    note: 'Locker shipping modeled after Vinted Go parcel lockers.',
  },
  {
    id: 'postnl-letterbox',
    carrier: 'PostNL',
    service: 'Letterbox tracked',
    priceMicro: 1_690_000,
    eta: '2-4 business days',
    note: 'Best for badges, sticker packs, lanyards, socks, and flat collectibles.',
  },
];

export const DEFAULT_SHIPPING_METHOD = SHIPPING_METHODS[0];

export const SHIPPING_CARRIER_OPTIONS = Array.from(
  new Set(SHIPPING_METHODS.map((method) => method.carrier))
);

export function getShippingMethod(id: string | null | undefined): ShippingMethod | null {
  if (!id) return null;
  return SHIPPING_METHODS.find((method) => method.id === id) ?? null;
}

export function getShippingMethodByPrice(priceMicro: number): ShippingMethod | null {
  return SHIPPING_METHODS.find((method) => method.priceMicro === priceMicro) ?? null;
}

export function resolveShippingMethod(
  id: string | null | undefined,
  priceMicro: number
): ShippingMethod {
  return getShippingMethod(id) ?? getShippingMethodByPrice(priceMicro) ?? DEFAULT_SHIPPING_METHOD;
}

export function getShippingMethodDisplay(
  id: string | null | undefined,
  priceMicro: number
): string {
  const method = resolveShippingMethod(id, priceMicro);
  return `${method.carrier} ${method.service}`;
}
