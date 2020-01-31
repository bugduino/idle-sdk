# @idle/sdk

## Install

```
$ npm install @idle/sdk
```

or

```
$ yarn add @idle/sdk
```

## Usage

All examples are with DAI. If you want to calculate params for other assets eg USDC, you have to change the last parameter accordingly (eg. 'USDC' instead of 'DAI').

#### getParamsForMint
```js
const idleSDK = require("@idle/sdk");

// first parameter: the new amount of token (DAI) you are supplying. It should be an hex or a string
// second parameter is a web3 instance like
// const web3 = new Web3(`https://mainnet.infura.io/v3/YOUR_INFURA_KEY`);
// third parameter is the account who will submit the tx, it's important
// to use the actual account who will submit the tx because we are making a contract call with that account so it should have the correct balance which plan to mint
// fourth param (optional) is a string with network used, default 'mainnet'
// last param (optional) is a string with asset used, default 'DAI'
const res = await idleSDK.getParamsForMint(
  web3.utils.toHex("100000000000000000000"), // 100
  web3,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', // caller
  'mainnet',
  'DAI'
);
//=> [amountForCompound, amountForFulcrum]
```
### mint

```js
// There is also a convenient method to get parameters and also directly make the mint tx (caller account must be unlocked), all params are the same as `getParamsForMint`
const res = await idleSDK.mint(
  web3.utils.toHex("100000000000000000000"), // 100
  web3,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // caller
);
```

#### getParamsForRedeem
```js
const idleSDK = require("@idle/sdk");

// first parameter: the amount of idle token (idleDAI) you want to burn. It should be an hex or a string
// second parameter is wheter to skip the rebalance or not. It should be `false`
// all other params are the same of `getParamsForMint`
const res = await idleSDK.getParamsForRedeem(
  web3.utils.toHex("100000000000000000000"), // 100
  false,
  web3,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // caller
);
//=> [amountForCompound, amountForFulcrum]
```

### redeem
```js
// There is also a convenient method to get parameters and also directly make the redeem tx (caller account must be unlocked), all params are the same as `getParamsForRedeem`
const res = await idleSDK.redeem(
  web3.utils.toHex("100000000000000000000"), // 100
  false,
  web3,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // caller
);
```

#### getParamsForRebalance
```js
const idleSDK = require("@idle/sdk");

// first parameter: the new amount of token (DAI) you are supplying, it could be 0 in case you don't want to mint any new amount. It should be an hex or a string
// all other params are the same of `getParamsForMint`
const res = await idleSDK.getParamsForRebalance(
  web3.utils.toHex("100000000000000000000"), // 100
  web3,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // caller
);
//=> [amountForCompound, amountForFulcrum]
```
### mint

```js
// There is also a convenient method to get parameters and also directly make the rebalance tx (caller account must be unlocked), all params are the same as `getParamsForMint`
const res = await idleSDK.mint(
  web3.utils.toHex("100000000000000000000"), // 100
  web3,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' // caller
);
```
