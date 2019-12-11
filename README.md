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

```js
const calculateAllocations = require("@idle/sdk");

// first parameter is the new amount of token you are supplying to Idle, it should be a bignumber instance or a string, in this example is `100` in wei
// second parameter is a web3 instance like
// const web3 = new Web3(`https://kovan.infura.io/v3/YOUR_INFURA_KEY`);
// third parameter is an object like the following one
// const addresses = {
//   underlying: '0xC4375B7De8af5a38a93548eb8453a498222C4fF2',
//   idleAddress: '0x03f79C6bF275651106Cd172c1650E9a78585e3BA',
//   cAddress: '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355',
//   iAddress: '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6'
// };
// NOTE: addresses should reflect the network choosen in the web3 providers, in this case kovan addresses
const res = await calculateAllocations("100000000000000000000", web3, addresses);
//=> []
```
