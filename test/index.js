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
    const web3 = new Web3(`https://mainnet.infura.io/v3/${YOUR_INFURA_KEY}`);

    // ***NOTE*** one should first approve the Idle contract used eg.
    // DAI = await IERC20.at("0x6B175474E89094C44Da98b954EedeAC495271d0F")
    // await DAI.approve("", web3.utils.toBN("1000000000000000000000000000"), {from: "0x83Deb18dC5574dF9558ABF719b7e109fe050560e", gasPrice: web3.utils.toBN("1000000000")})
    const res = await idleSDK.getParamsForMint(
      web3.utils.toHex(BNify("1000000000000000000")), // 1
      web3,
      '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', // caller
      'mainnet',
      'DAI'
    );
    console.log(res.map(amount => BNify(amount).div(one).toString()));
  });
});
