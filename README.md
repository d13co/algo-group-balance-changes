# @d13co/algo-group-balance-impact

Calculate the net balance impact of Algorand transaction groups.

## Installation

```bash
npm install @d13co/algo-group-balance-impact
```

## Usage

```typescript
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { calculateGroupBalanceImpact } from '@d13co/algo-group-balance-impact';

const { client: { indexer } } = await AlgorandClient.mainNet();

const result = await calculateGroupBalanceImpact({
  indexer,
  groupId: 'your-group-id',
  round: 12345678,
  convertDecimals: true,  // Convert amounts using asset decimals
  unitNameKeys: true,     // Use unit names (e.g., "ALGO") instead of asset IDs
});

if (result) {
  console.log(result.balanceImpact);
  // {
  //   "ADDR1...": { "ALGO": -1.5, "USDC": 100 },
  //   "ADDR2...": { "ALGO": 1.5, "USDC": -100 }
  // }
}
```

## API

### `calculateGroupBalanceImpact(params)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `indexer` | `Indexer` | Algorand indexer client |
| `txnId` | `string?` | Transaction ID to lookup group |
| `txn` | `Transaction?` | Transaction object to lookup group |
| `groupId` | `string?` | Group ID (requires `round`) |
| `round` | `number?` | Block round (required with `groupId`) |
| `block` | `Block?` | Cached block to avoid re-fetching |
| `convertDecimals` | `boolean?` | Convert to decimal amounts |
| `unitNameKeys` | `boolean?` | Use asset unit names as keys |
| `includeFees` | `boolean?` | Include transaction fees in balance |

Returns `GroupBalanceImpactResult` with `balanceImpact`, `group`, and `block`.

## License

MIT

