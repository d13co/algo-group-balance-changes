import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { calculateGroupBalanceImpact } from '../src/index';
import { decodeAddress, indexerModels } from 'algosdk';

const address = process.argv[2];
const limit = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
const minRound = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;
const maxRound = process.argv[5] ? parseInt(process.argv[5], 10) : undefined;

if (!address) {
  console.error('Please provide an address as the first argument');
  process.exit(1);
} else {
  try {
    decodeAddress(address); // validate address
  } catch (e) {
    console.error('Invalid Algorand address provided');
    process.exit(1);
  }
}

const {
  client: { indexer },
} = await AlgorandClient.mainNet();

let query = indexer.searchForTransactions().txType('axfer').address(process.argv[2]);

if (minRound) query = query.minRound(minRound);
if (maxRound) query = query.maxRound(maxRound);

if (limit) query = query.limit(limit);

const processedGroups = new Set<string>();
const blockCache = new Map<number, indexerModels.Block>();

let { transactions, nextToken } = await query.do();

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

do {
  await processTxns();
  await sleep(1000);
  if (nextToken) {
    const resp = await query.nextToken(nextToken).do();
    transactions = resp.transactions;
    nextToken = resp.nextToken;
  }
} while (nextToken);

async function processTxns() {
  process.stderr.write('!');
  for (const txn of transactions) {
    if (txn.group === undefined) {
      continue;
    }
    const groupId = Buffer.from(txn.group).toString('base64');
    if (processedGroups.has(groupId)) {
      continue;
    }

    const ts = new Date((txn.roundTime ?? 0) * 1000).toISOString();
    const round = Number(txn.confirmedRound);

    // Check if block is cached
    const cachedBlock = blockCache.get(round);

    const result = await calculateGroupBalanceImpact({
      indexer,
      groupId,
      round,
      block: cachedBlock,
      convertDecimals: true,
      unitNameKeys: true,
    });

    // Cache the block for future use
    if (result && !cachedBlock) {
      blockCache.set(round, result.block);
    }

    process.stderr.write('.');

    if (result && result.balanceImpact?.[address]) {
      const { balanceImpact, group } = result;
      const payment = group.find(
        (t) => (t.txType === 'axfer' || t.txType === 'pay') && t.sender === address
      );
      const acct = payment?.sender.substring(0, 8);
      const keys = Object.keys(balanceImpact[address]);
      if (keys.length < 2 || !keys.includes('ALGO')) {
        processedGroups.add(groupId);
        continue;
      }
      const otherKey = keys.find((k) => k !== 'ALGO');
      const rate = Math.round(
        Math.abs(balanceImpact[address].ALGO / balanceImpact[address][otherKey!])
      );
      const finalImpact = { ts, acct, rate, ...balanceImpact[address], txId: payment?.id };
      console.log(JSON.stringify(finalImpact));
    }

    processedGroups.add(groupId);
  }
}
