const BigNumber = require('bignumber.js');
const IdleToken = require('./abi/IdleToken.json');
const BNify = s => new BigNumber(String(s));

const addresses = {
  mainnet: {
    DAI: {
      underlying: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      idleAddress: '0x6cD46Ede85746AcC2eE8aBF1DA1AAb408384A00b',
      cAddress: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      iAddress: '0x493C57C4763932315A328269E1ADaD09653B9081'
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
