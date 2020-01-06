require('dotenv').config()

const assert = require('chai').assert;
const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const idleSDK = require('../index.js');

const BNify = s => new BigNumber(String(s));
const one = BNify('1000000000000000000');

describe('Test index', () => {
  it('getParamsForMint', async () => {
    const YOUR_INFURA_KEY = process.env.INFURA_KEY;
    const web3 = new Web3(`http://127.0.0.1:8545`);
    // const web3 = new Web3(`https://mainnet.infura.io/v3/${YOUR_INFURA_KEY}`);
    // const web3 = new Web3(`https://kovan.infura.io/v3/${YOUR_INFURA_KEY}`);

    const res = await idleSDK.getParamsForMint(
      web3.utils.toHex(BNify("100000000000000000000")), // 100
      web3,
      '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // caller
    );
    console.log(res.map(amount => BNify(amount).div(one).toString()));
  });
});
