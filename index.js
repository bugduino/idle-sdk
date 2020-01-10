const BigNumber = require('bignumber.js');
const IdleToken = require('./abi/IdleToken.json');
const BNify = s => new BigNumber(String(s));

const addresses = {
  mainnet: {
    DAI: {
      underlying: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      // TODO change this
      idleAddress: '',
      cAddress: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      iAddress: '0x493C57C4763932315A328269E1ADaD09653B9081'
    },
    SAI: {
      underlying: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
      // TODO change this
      idleAddress: '',
      cAddress: '0xf5dce57282a584d2746faf1593d3121fcac444dc',
      iAddress: '0x14094949152eddbfcd073717200da82fed8dc960'
    },
    USDC: {
      underlying: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      idleAddress: '',
      cAddress: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
      iAddress: '0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f'
    }
  },
  kovan: {
    SAI: {
      underlying: '0xC4375B7De8af5a38a93548eb8453a498222C4fF2', // SAI address
      idleAddress: '0x5266C66FC100d2FBE5dbCfE8a8789568D2d2F720',
      cAddress: '0x63c344BF8651222346DD870be254D4347c9359f7', // new interest rate model
      iAddress: '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6',
    },
    DAI: {
      underlying: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa', // DAI address
      idleAddress: '0x199e7c55B44fFBD2934bFC3bDeE05F6EC2b547CF',
      cAddress: '0xe7bc397dbd069fc7d0109c0636d06888bb50668c', // new interest rate model
      iAddress: '0x6c1e2b0f67e00c06c8e2be7dc681ab785163ff4d'
    }
  }
};

function sortAmounts(resGetParams, network = 'mainnet', asset = 'DAI') {
  const bigZero = BNify('0');
  const returnedAddresses = resGetParams[0] || [];
  const returnedAmounts = resGetParams[1] || []; // in underlying (eg. DAI)

  // One should pass amounts as an array in this exact order [amountForCompound, amountForFulcrum]
  const compoundIdx = returnedAddresses.findIndex(addr => addr.toLowerCase() === addresses[network][asset].cAddress.toLowerCase());
  const fulcrumIdx = returnedAddresses.findIndex(addr => addr.toLowerCase() === addresses[network][asset].iAddress.toLowerCase());
  return [
    compoundIdx >= 0 ? BNify(returnedAmounts[compoundIdx]) : bigZero,
    fulcrumIdx >= 0 ? BNify(returnedAmounts[fulcrumIdx]) : bigZero
  ];
}

async function getAllocations(method, getParamsMethod, methodParams, web3, caller, network = 'mainnet', asset = 'DAI') {
  const idleTokenContract = new web3.eth.Contract(IdleToken, addresses[network][asset].idleAddress);
  const resGetParams = await idleTokenContract.methods[getParamsMethod](...methodParams).call({from: caller}).catch(err => {
    console.log(`Error with ${getParamsMethod} -- ${err.message}`);
  });
  return sortAmounts(resGetParams, network, asset);
};

async function sendTxWithParams(method, getParamsMethod, methodParams, web3, caller, network = 'mainnet', asset = 'DAI') {
  const idleTokenContract = new web3.eth.Contract(IdleToken, addresses[network][asset].idleAddress);
  const allocations = await getAllocations(...arguments);
  if (!allocations.length) {
    return console.log(`Error while retrieving allocations`);
  }

  return await idleTokenContract.methods[method](
    ...(methodParams),
    allocations.map(a => web3.utils.toHex(a))
  ).send({from: caller}).catch(err => {
    console.log(`Error with ${method} -- ${err.message}`);
  });
};

// mint
const getParamsForMint = async (newAmount, web3, caller, network = 'mainnet', asset = 'DAI') =>
  await getAllocations('', 'getParamsForMintIdleToken', [newAmount], web3, caller, network, asset);
const mint = async (newAmount, web3, caller, network = 'mainnet', asset = 'DAI') =>
  await sendTxWithParams('mintIdleToken', 'getParamsForMintIdleToken', [newAmount], web3, caller, network, asset);
// redeem
const getParamsForRedeem = async (idleTokenAmount, skipRebalance, web3, caller, network = 'mainnet', asset = 'DAI') =>
  await getAllocations('', 'getParamsForRedeemIdleToken', [idleTokenAmount, skipRebalance], web3, caller, network, asset);
const redeem = async (idleTokenAmount, skipRebalance, web3, caller, network = 'mainnet', asset = 'DAI') =>
  await sendTxWithParams('redeemIdleToken', 'getParamsForRedeemIdleToken', [idleTokenAmount, skipRebalance], web3, caller, network, asset);
// rebalance
const getParamsForRebalance = async (newAmount, web3, caller, network = 'mainnet', asset = 'DAI') =>
  await getAllocations('', 'getParamsForRebalance', [newAmount], web3, caller, network, asset);
const rebalance = async (newAmount, web3, caller, network = 'mainnet', asset = 'DAI') =>
  await sendTxWithParams('rebalance', 'getParamsForRebalance', [newAmount], web3, caller, network, asset);

module.exports = { getParamsForMint, mint, getParamsForRedeem, redeem, getParamsForRebalance, rebalance };
