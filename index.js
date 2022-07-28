const { ethers, Contract, Wallet, BigNumber } = require('ethers');
const commandLineUsage = require('command-line-usage');
const commandLineArgs = require('command-line-args');
const { parseUnits } = require('ethers/lib/utils');
const vaultABI = require('./abis/vault.json');
const erc20ABI = require('./abis/erc20.json');

const usage = commandLineUsage([
  {
    header: 'Backend deposit/withdrawal helper',
    content:
      'Backend application to assist with deposit/withdrawal calls on the Sandclock Vault contract',
  },
  {
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

  const underlyingContract = new Contract(
    process.env.UNDERLYING_ADDRESS,
    erc20ABI,
    wallet,
  );
  const vaultContract = new Contract(
    process.env.VAULT_ADDRESS,
    vaultABI,
    wallet,
  );

  switch (options.action) {
    case 'withdraw':
      if (options.depositId) {
        await withdraw([parseInt(options.depositId)]);

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
    case 'generateYield':
      await generateYield();
      break;
    case 'claimYield':
      await claimYield();
      break;
    default:
      console.log(usage);
  }

  provider.destroy();

  async function deposit() {
    await (
      await underlyingContract.approve(
        process.env.VAULT_ADDRESS,
        parseUnits('1000', 18),
      )
    ).wait();

    console.log('approve transaction mined');

    await (
      await vaultContract.deposit({
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
            beneficiary: await vaultContract.treasury(),
            pct: 9000,
            data: 0x46e0b937,
          },
        ],
        name: 'deposit-withdraw script test foundation',
        slippage: BigNumber.from('1'),
      })
    ).wait();

    console.log('deposit transaction mined');
  }

  async function generateYield() {
    await (
      await underlyingContract.mint(
        vaultContract.address,
        parseUnits('2000', 18),
      )
    ).wait();

    console.log('generateYield transaction mined');
  }

  async function claimYield() {
    await (
      await vaultContract.claimYield(await vaultContract.treasury())
    ).wait();

    console.log('claimYield transaction mined');
  }

  async function withdraw(depositIds) {
    await (
      await vaultContract.partialWithdraw(walletAddress, depositIds, [
        parseUnits('150'),
      ])
    ).wait();

    console.log('withdraw transaction mined');
  }

  async function claim() {
    await (await vaultContract.claimYield(walletAddress)).wait();

    console.log('claimYield transaction mined');
  }
})();
