import { Indexer, indexerModels } from 'algosdk';
import {
  lookupTxnGroupByTxnId,
  lookupTxnGroupByTxn,
  lookupGroupById,
  LookupGroupResult,
} from './utils/lookupGroup';
import { AssetCache, AssetInfo } from './utils/AssetCache';

// Balance impact types
type AssetKey = number | string; // 0 for ALGO (or "ALGO" if unitNameKeys)
type BalanceDeltas = Record<AssetKey, number>;
export type BalanceImpact = Record<string, BalanceDeltas>;

export interface TransactionBalanceImpactResult {
  balanceImpact: BalanceImpact;
  transaction: indexerModels.Transaction;
}

export interface GroupBalanceImpactResult {
  balanceImpact: BalanceImpact;
  group: indexerModels.Transaction[];
  block: indexerModels.Block;
}

// Global persistent asset cache
export const assetCache = new AssetCache();

export interface CalculateGroupBalanceImpactParams {
  indexer: Indexer;
  txnId?: string;
  txn?: indexerModels.Transaction;
  groupId?: string;
  round?: number;
  block?: indexerModels.Block;
  convertDecimals?: boolean;
  unitNameKeys?: boolean;
  includeFees?: boolean;
}

export interface RawBalanceDeltas {
  [account: string]: {
    [assetId: number]: bigint;
  };
}

const ALGO_ASSET_ID = 0;
const ALGO_DECIMALS = 6;

function addBalanceChange(
  balances: RawBalanceDeltas,
  account: string,
  assetId: number,
  amount: bigint
): void {
  balances[account] ??= {};
  balances[account][assetId] ??= 0n;
  balances[account][assetId] += amount;
}

export function processTransaction(
  txn: indexerModels.Transaction,
  balances: RawBalanceDeltas,
  includeFees: boolean = false
): Set<number> {
  const assetIds = new Set<number>();

  // Process transaction fee (if includeFees is enabled)
  if (includeFees && txn.fee) {
    addBalanceChange(balances, txn.sender, ALGO_ASSET_ID, -txn.fee);
    assetIds.add(ALGO_ASSET_ID);
  }

  // Process payment transaction (ALGO transfer)
  if (txn.paymentTransaction) {
    const pay = txn.paymentTransaction;
    const sender = txn.sender;
    const receiver = pay.receiver;
    const amount = pay.amount;

    // Sender loses ALGO
    addBalanceChange(balances, sender, ALGO_ASSET_ID, -amount);
    // Receiver gains ALGO
    addBalanceChange(balances, receiver, ALGO_ASSET_ID, amount);
    assetIds.add(ALGO_ASSET_ID);

    // Handle close remainder
    if (pay.closeRemainderTo && pay.closeAmount) {
      addBalanceChange(balances, sender, ALGO_ASSET_ID, -pay.closeAmount);
      addBalanceChange(balances, pay.closeRemainderTo, ALGO_ASSET_ID, pay.closeAmount);
    }
  }

  // Process asset transfer transaction
  if (txn.assetTransferTransaction) {
    const axfer = txn.assetTransferTransaction;
    const assetId = Number(axfer.assetId);
    const amount = axfer.amount;
    // For clawback, sender field is the account being clawed from
    const effectiveSender = axfer.sender ?? txn.sender;
    const receiver = axfer.receiver;

    // Sender loses asset
    addBalanceChange(balances, effectiveSender, assetId, -amount);
    // Receiver gains asset
    addBalanceChange(balances, receiver, assetId, amount);
    assetIds.add(assetId);

    // Handle close to
    if (axfer.closeTo && axfer.closeAmount) {
      addBalanceChange(balances, effectiveSender, assetId, -axfer.closeAmount);
      addBalanceChange(balances, axfer.closeTo, assetId, axfer.closeAmount);
    }
  }

  // Recursively process inner transactions for application calls
  if (txn.innerTxns && txn.innerTxns.length > 0) {
    for (const innerTxn of txn.innerTxns) {
      const innerAssetIds = processTransaction(innerTxn, balances, includeFees);
      innerAssetIds.forEach((id) => assetIds.add(id));
    }
  }

  return assetIds;
}

export async function getAssetDecimals(indexer: Indexer, assetId: number): Promise<number> {
  if (assetId === ALGO_ASSET_ID) {
    return ALGO_DECIMALS;
  }

  // Check cache first
  const cached = assetCache.get(assetId);
  if (cached) {
    return cached.decimals;
  }

  // Fetch from indexer and cache
  const response = await indexer.lookupAssetByID(assetId).includeAll(true).do();
  const info: AssetInfo = {
    decimals: response.asset.params.decimals,
    unitName: response.asset.params.unitName ?? String(assetId),
  };
  assetCache.set(assetId, info);

  return info.decimals;
}

export async function getAssetUnitName(indexer: Indexer, assetId: number): Promise<string> {
  if (assetId === ALGO_ASSET_ID) {
    return 'ALGO';
  }

  // Check cache first
  const cached = assetCache.get(assetId);
  if (cached) {
    return cached.unitName;
  }

  // Fetch from indexer and cache
  const response = await indexer.lookupAssetByID(assetId).includeAll(true).do();
  const info: AssetInfo = {
    decimals: response.asset.params.decimals,
    unitName: response.asset.params.unitName ?? String(assetId),
  };
  assetCache.set(assetId, info);

  return info.unitName;
}

interface PostProcessOptions {
  indexer: Indexer;
  convertDecimals?: boolean;
  unitNameKeys?: boolean;
}

async function postProcessBalances(
  rawBalances: RawBalanceDeltas,
  allAssetIds: Set<number>,
  options: PostProcessOptions
): Promise<BalanceImpact> {
  const { indexer, convertDecimals, unitNameKeys } = options;

  // Get decimals for all assets (only if converting)
  const decimalsMap = new Map<number, number>();
  if (convertDecimals) {
    for (const assetId of allAssetIds) {
      const decimals = await getAssetDecimals(indexer, assetId);
      decimalsMap.set(assetId, decimals);
    }
  }

  // Get unit names for all assets (only if using unit name keys)
  const unitNameMap = new Map<number, string>();
  if (unitNameKeys) {
    for (const assetId of allAssetIds) {
      const unitName = await getAssetUnitName(indexer, assetId);
      unitNameMap.set(assetId, unitName);
    }
  }

  // Convert to result format
  const result: BalanceImpact = {};
  for (const [account, assets] of Object.entries(rawBalances)) {
    result[account] = {};
    for (const [assetIdStr, rawAmount] of Object.entries(assets)) {
      const assetId = Number(assetIdStr);
      let finalAmount: number;

      if (convertDecimals) {
        const decimals = decimalsMap.get(assetId) ?? 0;
        finalAmount = Number(rawAmount) / Math.pow(10, decimals);
      } else {
        finalAmount = Number(rawAmount);
      }

      if (finalAmount !== 0) {
        const key = unitNameKeys ? (unitNameMap.get(assetId) ?? assetId) : assetId;
        result[account][key] = finalAmount;
      }
    }
    // Remove empty accounts
    if (Object.keys(result[account]).length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete result[account];
    }
  }

  return result;
}

export interface CalculateTransactionBalanceImpactParams {
  indexer: Indexer;
  txnId?: string;
  txn?: indexerModels.Transaction;
  convertDecimals?: boolean;
  unitNameKeys?: boolean;
  includeFees?: boolean;
}

export async function calculateTransactionBalanceImpact({
  indexer,
  txnId,
  txn,
  convertDecimals,
  unitNameKeys,
  includeFees,
}: CalculateTransactionBalanceImpactParams): Promise<TransactionBalanceImpactResult | null> {
  // Get the transaction
  let transaction: indexerModels.Transaction | undefined = txn;

  if (txnId && !transaction) {
    const response = await indexer.lookupTransactionByID(txnId).do();
    transaction = response.transaction;
  }

  if (!transaction) {
    return null;
  }

  // Track raw balance changes
  const rawBalances: RawBalanceDeltas = {};
  const allAssetIds = processTransaction(transaction, rawBalances, includeFees);

  const balanceImpact = await postProcessBalances(rawBalances, allAssetIds, {
    indexer,
    convertDecimals,
    unitNameKeys,
  });

  return { balanceImpact, transaction };
}

export async function calculateGroupBalanceImpact({
  indexer,
  txnId,
  txn,
  groupId,
  round,
  block,
  convertDecimals,
  unitNameKeys,
  includeFees,
}: CalculateGroupBalanceImpactParams): Promise<GroupBalanceImpactResult | null> {
  // Get all transactions in the group
  let result: LookupGroupResult | null = null;

  if (txnId) {
    result = await lookupTxnGroupByTxnId({ txnId, indexer, block });
  } else if (txn) {
    result = await lookupTxnGroupByTxn({ txn, indexer, block });
  } else if (groupId && round !== undefined) {
    result = await lookupGroupById({ groupId, round, indexer, block });
  }

  if (!result || result.group.length === 0) {
    return null;
  }

  const { group: transactions, block: resultBlock } = result;

  // Track raw balance changes
  const rawBalances: RawBalanceDeltas = {};
  const allAssetIds = new Set<number>();

  // Process each transaction in the group
  for (const transaction of transactions) {
    const assetIds = processTransaction(transaction, rawBalances, includeFees);
    assetIds.forEach((id) => allAssetIds.add(id));
  }

  const balanceImpact = await postProcessBalances(rawBalances, allAssetIds, {
    indexer,
    convertDecimals,
    unitNameKeys,
  });

  return { balanceImpact, group: transactions, block: resultBlock };
}
