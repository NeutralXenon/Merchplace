type WalletPublicKey = {
  toBase58(): string;
};

type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

type ShippingPayload = {
  tracking_number: string;
  carrier: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

type SavedShipment = {
  id: string;
  listing_id: string;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

type SaveSellerShipmentInput<TPublicKey extends WalletPublicKey, TSaved extends SavedShipment> = {
  listingId: string;
  publicKey: TPublicKey | null;
  signMessage: SignMessage | undefined;
  shipment: ShippingPayload;
  ensureSession: (
    publicKey: TPublicKey | null,
    signMessage: SignMessage | undefined
  ) => Promise<void>;
  saveRemote: (listingId: string, shipment: ShippingPayload) => Promise<TSaved>;
};

export async function saveSellerShipment<TPublicKey extends WalletPublicKey, TSaved extends SavedShipment>({
  listingId,
  publicKey,
  signMessage,
  shipment,
  ensureSession,
  saveRemote,
}: SaveSellerShipmentInput<TPublicKey, TSaved>): Promise<TSaved> {
  await ensureSession(publicKey, signMessage);
  return saveRemote(listingId, shipment);
}
