import { Indexer, indexerModels, base64ToBytes, bytesToBase64 } from 'algosdk';

export interface LookupGroupResult {
  group: indexerModels.Transaction[];
  block: indexerModels.Block;
}

interface LookupGroupByIdParams {
  groupId: string;
  round: number;
  block?: indexerModels.Block;
  indexer: Indexer;
}

export async function lookupGroupById({
  groupId,
  round,
  indexer,
  block,
}: LookupGroupByIdParams): Promise<LookupGroupResult | null> {
  block ??= await indexer.lookupBlock(round).do();

  if (!block.transactions) {
    return { group: [], block };
  }

  const groupIdBytes = base64ToBytes(groupId);

  const group = block.transactions.filter((txn: indexerModels.Transaction) => {
    if (!txn.group) {
      return false;
    }
    return bytesToBase64(txn.group) === bytesToBase64(groupIdBytes);
  });

  return { group, block };
}

interface LookupTxnGroupByTxnParams {
  txn: indexerModels.Transaction;
  block?: indexerModels.Block;
  indexer: Indexer;
}

export async function lookupTxnGroupByTxn({
  txn,
  block,
  indexer,
}: LookupTxnGroupByTxnParams): Promise<LookupGroupResult | null> {
  if (!txn.group || !txn.confirmedRound) {
    return null;
  }

  const groupId = bytesToBase64(txn.group);
  return lookupGroupById({ groupId, round: Number(txn.confirmedRound), block, indexer });
}

interface LookupTxnGroupByTxnIdParams {
  txnId: string;
  block?: indexerModels.Block;
  indexer: Indexer;
}

export async function lookupTxnGroupByTxnId({
  txnId,
  block,
  indexer,
}: LookupTxnGroupByTxnIdParams): Promise<LookupGroupResult | null> {
  const transaction = block
    ? block.transactions?.find((t) => t.id === txnId)
    : (await indexer.lookupTransactionByID(txnId).do()).transaction;
  if (!transaction) {
    return null;
  }
  return lookupTxnGroupByTxn({ txn: transaction, indexer, block });
}
