require('dotenv').config()

const assert = require('chai').assert;
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const calculateAllocations = require('../index.js');

const BNify = s => new BigNumber(String(s));
const one = BNify('1000000000000000000');

// const addressesSAIKovan = {
//   underlying: '0xC4375B7De8af5a38a93548eb8453a498222C4fF2',
//   idleAddress: '0x03f79C6bF275651106Cd172c1650E9a78585e3BA',
//   // cAddress: '0x63c344BF8651222346DD870be254D4347c9359f7', // new interestRateModel
//   cAddress: '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355', // old interestRateModel
//   iAddress: '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6'
// };

// // SAI main (old interest rate model)
const addressesSAIMain = {
  underlying: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
  idleAddress: '0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9',
  cAddress: '0xf5dce57282a584d2746faf1593d3121fcac444dc',
  iAddress: '0x14094949152eddbfcd073717200da82fed8dc960'
}
// // DAI main (new interest rate model)
// const addressesDAIMain = {
//   underlying: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
//   idleAddress: '0xacf651aad1cbb0fd2c7973e2510d6f63b7e440c9', // this is SAI addr but its ok for tests
//   cAddress: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
//   iAddress: '0x493C57C4763932315A328269E1ADaD09653B9081'
// }

describe('Test index', () => {
  it('calculateAllocations', async () => {
    const YOUR_INFURA_KEY = process.env.INFURA_KEY;
    const web3 = new Web3(`https://mainnet.infura.io/v3/${YOUR_INFURA_KEY}`);
    // const web3 = new Web3(`https://kovan.infura.io/v3/${YOUR_INFURA_KEY}`);
    const expectedVal = [BNify('1').times(one), BNify('2').times(one)];
    const res = await calculateAllocations("100000000000000000000", web3, addressesSAIMain);
    assert(res[0] === expectedVal, 'Allocation for Compound is not correct');
    assert(res[1] === expectedVal, 'Allocation for Fulcrum is not correct');
  });
});
