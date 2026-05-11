import type { EscrowAction, EscrowNoticeTone, EscrowRole, EscrowStatus } from './escrowTrust';

export type DisputeGuidance = {
  title: string;
  body: string;
  action: string;
  tone: EscrowNoticeTone;
};

export type DisputeTimelineStep = {
  title: string;
  body: string;
};

export const DISPUTE_POLICY = {
  trackingWindowDays: 3,
  inspectionWindowDays: 7,
  limitation:
    'No on-chain dispute arbitration exists yet. Merchplace currently makes custody, tracking, cancellation, and receipt confirmation explicit.',
} as const;

export function getDisputeGuidance(
  status: EscrowStatus,
  role: EscrowRole,
  hasTracking: boolean
): DisputeGuidance {
  if (status === 'available') {
    return {
      title: 'Know the failure path before signing',
      body: `After purchase, the seller should add tracking within ${DISPUTE_POLICY.trackingWindowDays} days. Buyer funds stay in escrow until receipt confirmation or cancellation.`,
      action: 'Review policy before purchase',
      tone: 'info',
    };
  }

  if (status === 'in_escrow' && !hasTracking) {
    if (role === 'seller') {
      return {
        title: 'Tracking is overdue risk',
        body: `Add tracking within ${DISPUTE_POLICY.trackingWindowDays} days so the buyer can verify shipment. Without tracking, the buyer should not confirm receipt.`,
        action: 'Add tracking now',
        tone: 'warning',
      };
    }

    return {
      title: 'Tracking is the next proof point',
      body: `If tracking is not added within ${DISPUTE_POLICY.trackingWindowDays} days, use cancellation before confirming receipt. Do not release escrow for a package you cannot verify.`,
      action: 'Wait for tracking or cancel',
      tone: 'warning',
    };
  }

  if (status === 'in_escrow' && hasTracking) {
    if (role === 'seller') {
      return {
        title: 'Buyer is in the inspection window',
        body: `Tracking is saved. Give the buyer up to ${DISPUTE_POLICY.inspectionWindowDays} days after delivery to inspect the item before release.`,
        action: 'Keep proof ready',
        tone: 'info',
      };
    }

    return {
      title: 'Inspect before release',
      body: `Use tracking and item condition before confirming. If the item is wrong, cancel before receipt confirmation and keep seller messages as proof.`,
      action: 'Confirm only when satisfied',
      tone: 'info',
    };
  }

  if (status === 'sold') {
    return {
      title: 'Release is final',
      body: 'Receipt was confirmed and seller funds were released. Merchplace cannot reverse the escrow release on-chain.',
      action: 'Trade complete',
      tone: 'success',
    };
  }

  return {
    title: 'Listing is closed',
    body: 'Cancelled listings cannot start a new escrow. Browse active listings or create a fresh listing.',
    action: 'Closed',
    tone: 'danger',
  };
}

export function getDisputeTimeline(
  status: EscrowStatus,
  hasTracking: boolean
): DisputeTimelineStep[] {
  if (status === 'available') {
    return [
      {
        title: 'Purchase opens escrow',
        body: 'Buyer deposits item price, shipping, and protection fee into the escrow account.',
      },
      {
        title: 'Seller adds tracking',
        body: `Seller should add carrier and tracking within ${DISPUTE_POLICY.trackingWindowDays} days.`,
      },
      {
        title: 'Buyer confirms or cancels',
        body: 'Buyer confirms only after delivery, or cancels before receipt confirmation if shipment is not credible.',
      },
    ];
  }

  if (status === 'in_escrow') {
    return [
      {
        title: hasTracking ? 'Tracking saved' : 'Seller adds tracking',
        body: hasTracking
          ? 'Buyer can follow shipment and inspect before releasing funds.'
          : `Seller should add carrier and tracking within ${DISPUTE_POLICY.trackingWindowDays} days.`,
      },
      {
        title: 'Inspection window',
        body: `After delivery, buyer has up to ${DISPUTE_POLICY.inspectionWindowDays} days to inspect before confirming receipt.`,
      },
      {
        title: 'Release or cancellation',
        body: 'Confirmation releases seller funds. Cancellation refunds the buyer and returns the listing to available.',
      },
    ];
  }

  if (status === 'sold') {
    return [
      {
        title: 'Receipt confirmed',
        body: 'Buyer confirmed delivery and accepted the item.',
      },
      {
        title: 'Trade complete',
        body: 'Seller funds and marketplace fee were released from escrow.',
      },
    ];
  }

  return [
    {
      title: 'Escrow closed',
      body: 'The listing was cancelled before a new purchase could begin.',
    },
  ];
}

export function getReviewRiskNotes(action: EscrowAction, hasTracking: boolean): string[] {
  if (action === 'confirm') {
    return [
      'Confirming receipt permanently releases seller funds.',
      hasTracking
        ? 'Tracking is saved, but you still need to inspect the item before signing.'
        : 'No tracking is saved. Only confirm if the item is already in hand.',
      DISPUTE_POLICY.limitation,
    ];
  }

  if (action === 'cancelPurchase') {
    return [
      'Cancellation returns escrow to the buyer and reopens the listing.',
      'Use this before receipt confirmation if shipment, tracking, or item condition is wrong.',
    ];
  }

  if (action === 'buy') {
    return [
      `Seller should add tracking within ${DISPUTE_POLICY.trackingWindowDays} days after purchase.`,
      DISPUTE_POLICY.limitation,
    ];
  }

  return [
    'Cancelling an available listing closes it for future buyers.',
  ];
}
