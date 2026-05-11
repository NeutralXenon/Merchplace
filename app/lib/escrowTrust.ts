export type EscrowAction = 'buy' | 'confirm' | 'cancelPurchase' | 'cancelListing';
export type EscrowRole = 'buyer' | 'seller' | 'visitor';
export type EscrowStatus = 'available' | 'in_escrow' | 'sold' | 'cancelled';
export type EscrowNoticeTone = 'info' | 'warning' | 'success' | 'danger';

export type EscrowPolicyStep = {
  title: string;
  body: string;
};

export type EscrowRoleNotice = {
  title: string;
  body: string;
  action: string;
  tone: EscrowNoticeTone;
};

export const ESCROW_POLICY_STEPS: EscrowPolicyStep[] = [
  {
    title: 'Deposit held in escrow',
    body: 'The buyer total stays locked in the Merchplace escrow account after wallet approval.',
  },
  {
    title: 'Seller ships with tracking',
    body: 'The seller keeps the item moving and adds tracking details so the buyer can verify delivery.',
  },
  {
    title: 'Buyer releases after receipt',
    body: 'Seller funds release only when the buyer confirms the item is in hand.',
  },
];

export function getEscrowRoleNotice(
  status: EscrowStatus,
  role: EscrowRole,
  hasTracking: boolean
): EscrowRoleNotice {
  if (status === 'available') {
    if (role === 'seller') {
      return {
        title: 'Listing is live',
        body: 'No buyer funds have moved yet. Keep the item ready or cancel before a buyer deposits.',
        action: 'Await buyer deposit',
        tone: 'info',
      };
    }

    return {
      title: 'Escrow starts at purchase',
      body: 'Review the total before signing. The seller is paid after receipt confirmation, not at checkout.',
      action: 'Review total before signing',
      tone: 'info',
    };
  }

  if (status === 'in_escrow') {
    if (role === 'buyer') {
      return {
        title: 'Wait for the package',
        body: hasTracking
          ? 'Use the tracking details and inspect the item before receipt confirmation.'
          : 'Tracking is not saved yet. Ask the seller for tracking and confirm only after delivery.',
        action: 'Confirm only after delivery',
        tone: hasTracking ? 'info' : 'warning',
      };
    }

    if (role === 'seller') {
      return {
        title: 'Ship and prove it',
        body: hasTracking
          ? 'Tracking is saved. Funds release after the buyer confirms the package arrived.'
          : 'Escrow is locked. Ship promptly, then save carrier and tracking details for the buyer.',
        action: 'Add tracking once shipped',
        tone: hasTracking ? 'success' : 'warning',
      };
    }

    return {
      title: 'Trade in progress',
      body: 'Funds are locked while the seller ships and the buyer waits for delivery.',
      action: 'Escrow is active',
      tone: 'warning',
    };
  }

  if (status === 'sold') {
    return {
      title: 'Escrow released',
      body: 'The buyer confirmed receipt and seller funds have been released.',
      action: 'Trade complete',
      tone: 'success',
    };
  }

  return {
    title: 'Listing cancelled',
    body: 'This listing is closed. No new purchase can start from this page.',
    action: 'Browse active listings',
    tone: 'danger',
  };
}

export function getReviewChecklist(action: EscrowAction, hasTracking: boolean): string[] {
  if (action === 'buy') {
    return [
      'Deposit goes into Merchplace escrow, not directly to the seller.',
      'Seller must ship and share tracking before release.',
      'Buyer confirms receipt to release seller funds.',
    ];
  }

  if (action === 'confirm') {
    return [
      hasTracking
        ? 'Tracking is saved. Confirm only after the package is in hand.'
        : 'No tracking is saved. Confirm only if the package is already in hand.',
      'This action releases seller funds and marks the item sold.',
      'Do not sign if the wallet approval shows different details.',
    ];
  }

  if (action === 'cancelPurchase') {
    return [
      'Refund returns to the buyer and the listing becomes available again.',
      'Use this before receipt confirmation if shipment or item details are wrong.',
    ];
  }

  return [
    'No escrow funds move when an available listing is cancelled.',
    'Buyers will no longer be able to purchase this item.',
  ];
}
