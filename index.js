const { ethers, Contract, Wallet } = require('ethers');
const commandLineUsage = require('command-line-usage');
const commandLineArgs = require('command-line-args');
const { parseUnits } = require('ethers/lib/utils');
const vaultABI = require('./abis/vault.json');
const erc20ABI = require('./abis/erc20.json');
const feedABI = require('./abis/mockPriceFeed.json');

const usage = commandLineUsage([
  {
    header: 'Backend deposit/withdrawal helper',
    content: 'Backend application to assist with deposit/withdrawal calls on the Sandclock Vault contract',
  }, {
    header: 'Options',
    optionList: [
      {
        name: 'action',
        type: String,
        description: 'deposit/withdraw/claim',
      },
      {
        name: 'depositId',
        type: Number,
        description: 'depositId for withdraw action',
      },
      {
        name: 'help',
        alias: 'h',
        description: 'print this usage guide',
      },
    ],
  },
]);

const options = commandLineArgs([
  {
    name: 'action',
    type: String,
  },
  {
    name: 'depositId',
    type: Number,
  },
  {
    name: 'help',
    alias: 'h',
  },
]);

if (options.help) {
  console.log(usage);
  process.exit(0);
}

let provider = new ethers.providers.WebSocketProvider(process.env.RPC_URL, {
  chainId: 3,
});
const wallet = Wallet.fromMnemonic(process.env.MNEMONIC).connect(provider);

(async () => {
  const walletAddress = await wallet.getAddress();

  const underlyingContract = new Contract(process.env.UNDERLYING_ADDRESS, erc20ABI, wallet);
  const vaultContract = new Contract(process.env.VAULT_ADDRESS, vaultABI, wallet);
  const feedContract = new Contract(process.env.FEED_ADDRESS, feedABI, wallet);

  switch (options.action) {
    case 'withdraw':
      if (options.depositId) {
        await withdraw(
          [parseInt(options.depositId)]
        );

        break;
      }

      console.log(usage);
      break;
    case 'deposit':
      await deposit();
      break;
    case 'claim':
      await claim();
      break;
    default:
      console.log(usage);
  }

  provider.destroy();

  async function deposit() {
    await (await underlyingContract.approve(process.env.VAULT_ADDRESS, parseUnits('1000', 18))).wait();

    console.log('approve transaction mined');

    await (await vaultContract.deposit({
        amount: parseUnits('1000', 18),
        inputToken: underlyingContract.address,
        lockDuration: 1,
        claims: [
          {
            beneficiary: walletAddress,
            pct: 1000,
            data: 0,
          },
          {
            beneficiary: walletAddress,
            pct: 9000,
            data: 0x46E0B937,
          },
        ],
        name: '0xrin test foundation',
      }
    )).wait();

    console.log('deposit transaction mined');
  }

  async function withdraw(depositIds) {
    let roundId = (await feedContract.latestRoundData()).roundId.toNumber();

    roundId += 1;

    await (await feedContract.setLatestRoundData(
      roundId,
      '1500000000000000000',
      0,
      roundId,
      roundId,
    )).wait();

    console.log('mock price feed round data transaction mined');

    await (await vaultContract.partialWithdraw(
        walletAddress,
        depositIds,
        [parseUnits('150')],
      )
    ).wait();

    console.log('withdraw transaction mined');
  }

  async function claim() {
    await (await vaultContract.claimYield(walletAddress)).wait();

    console.log('claimYield transaction mined');
  }
})();
