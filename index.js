const BigNumber = require('bignumber.js');

// abis
const IdleToken = require('./abi/IdleToken.json');
const IERC20 = require('./abi/IERC20.json');
const CERC20 = require('./abi/CERC20.json');
const WhitePaperInterestRateModel = require('./abi/WhitePaperInterestRateModel.json');
const iERC20Fulcrum = require('./abi/iERC20Fulcrum.json');

const BNify = s => new BigNumber(String(s));
const one = BNify('1000000000000000000');
const oneHundred = BNify('100').times(one);

// SAI kovan
// const addressesSAIKovan = {
//   underlying: '0xC4375B7De8af5a38a93548eb8453a498222C4fF2',
//   idleAddress: '0x03f79C6bF275651106Cd172c1650E9a78585e3BA',
//   cAddress: '0x63c344BF8651222346DD870be254D4347c9359f7', // new interestRateModel
//   // cAddress: '0x3BD3f5b19BCB7f96d42cb6A9dE510ea6f9096355', // old interestRateModel
//   iAddress: '0xA1e58F3B1927743393b25f261471E1f2D3D9f0F6'
// };

// // DAI kovan
// const addressesDAIKovan = {
//   underlying: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
//   idleAddress: '',
//   cAddress: '0xe7bc397dbd069fc7d0109c0636d06888bb50668c',
//   iAddress: ''
// };
//
// // SAI main
// const addressesSAIMain = {
//   underlying: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359',
//   idleAddress: '',
//   cAddress: '0xf5dce57282a584d2746faf1593d3121fcac444dc',
//   iAddress: '0x14094949152eddbfcd073717200da82fed8dc960'
// }
// // DAI main
// const addressesDAIMain = {
//   underlying: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
//   idleAddress: '',
//   cAddress: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
//   iAddress: '0x493C57C4763932315A328269E1ADaD09653B9081'
// }
async function calcNAVIdle(newAmount, idleTokenContract) {
  const idleTotSupply = await idleTokenContract.methods.totalSupply().call();
  const idleTokenPrice = await idleTokenContract.methods.tokenPrice().call();
  const netAssetValue = BNify(idleTotSupply).times(BNify(idleTokenPrice)).div(one).integerValue(BigNumber.ROUND_FLOOR);
  console.log(`${BNify(netAssetValue).div(one).toString()} underlying value in Idle pool`);
  return netAssetValue.plus(BNify(newAmount));
}
async function calcAllocationsNewRateModel(newAmount, web3, addresses, cTokenContract, whitePaperContract) {
  const underlyingTokenContract = new web3.eth.Contract(IERC20, addresses.underlying);
  const idleTokenContract = new web3.eth.Contract(IdleToken, addresses.idleAddress);
  const iTokenContract = new web3.eth.Contract(iERC20Fulcrum, addresses.iAddress);
  const cTokenWithSupplyContract = new web3.eth.Contract(IERC20, addresses.cAddress);

  // Get current netAssetValue in Idle contract
  const totalAmount = await calcNAVIdle(newAmount, idleTokenContract);
  console.log(`${BNify(totalAmount).div(one).toString()} underlying value in Idle pool + newAmount`);

  // Get all data for iToken
  let promises = [
    iTokenContract.methods.supplyInterestRate().call(),
    iTokenContract.methods.avgBorrowInterestRate().call(),
    iTokenContract.methods.totalAssetSupply().call(),
    iTokenContract.methods.totalAssetBorrow().call(),
    iTokenContract.methods.spreadMultiplier().call(),
    iTokenContract.methods.nextSupplyInterestRate(totalAmount.integerValue(BigNumber.ROUND_FLOOR).toFixed()).call(),
    iTokenContract.methods.tokenPrice().call(),
  ];

  const res = await Promise.all(promises);
  let [supplyRate, borrowRate, totalAssetSupply, totalAssetBorrow, spreadMultiplier, autoNextRate, tokenPrice] = res;

  supplyRate = BNify(supplyRate);
  borrowRate = BNify(borrowRate);
  totalAssetSupply = BNify(totalAssetSupply);
  totalAssetBorrow = BNify(totalAssetBorrow);
  spreadMultiplier = BNify(spreadMultiplier);
  autoNextRate = BNify(autoNextRate);
  tokenPrice = BNify(tokenPrice);

  const utilizationRate = BNify(totalAssetBorrow).div(BNify(totalAssetSupply));

  console.log(`CONTRACT FULCRUM current DATA:`);
  console.log(`${BNify(supplyRate).div(one).toString()}% curr supplyRate`);
  console.log(`${autoNextRate.div(one).toString()}% autoNextRate if supplying ${BNify(totalAmount).div(one).toString()} underlying`);

  const a1 = borrowRate;
  const b1 = totalAssetBorrow;
  let s1 = totalAssetSupply;
  const o1 = spreadMultiplier;
  const x1 = totalAmount;
  const k1 = oneHundred;

  const currentSupplyInterestRate = a1.times(b1.div(s1));
  const targetSupplyRate = a1.times(s1.div(s1.plus(x1))).times(b1.div(s1.plus(x1)))

  const currentSupplyInterestRateWithFee = a1.times(b1.div(s1))
    .times(o1).div(k1); // counting fee (spreadMultiplier)

  const targetSupplyRateWithFee = a1.times(s1.div(s1.plus(x1)))
    .times(b1.div(s1.plus(x1)))
    .times(o1).div(k1); // counting fee (spreadMultiplier)

  console.log(`${currentSupplyInterestRateWithFee.div(one).toString()} currentSupplyInterestRateWithFee`);
  console.log(`${targetSupplyRateWithFee.div(one).toString()} autoNextRateWithFee`);
  console.log(`############ END FULCRUM `);

  console.log(`CONTRACT COMPOUND current DATA (NEW INTEREST RATE MODEL):`);
  let promisesComp = [
    cTokenContract.methods.supplyRatePerBlock().call(),
    cTokenContract.methods.borrowRatePerBlock().call(),

    cTokenContract.methods.totalBorrows().call(),
    cTokenContract.methods.getCash().call(),
    cTokenContract.methods.totalReserves().call(),
    cTokenWithSupplyContract.methods.totalSupply().call(),
    cTokenContract.methods.reserveFactorMantissa().call(),
    cTokenContract.methods.exchangeRateStored().call(),
  ];
  const resComp = await Promise.all(promisesComp);
  const [
    contractSupply, contractBorrow,
    totalBorrows, getCash, totalReserves, totalSupply,
    reserveFactorMantissa, exchangeRateStored,
  ] = resComp;

  const whitePaperSupplyRate = await whitePaperContract.methods.getSupplyRate(
    BNify(getCash).plus(totalAmount).integerValue(BigNumber.ROUND_FLOOR).toFixed().toString(),
    BNify(totalBorrows).toFixed(),
    BNify(totalReserves).toFixed(),
    BNify(reserveFactorMantissa).toFixed()
  ).call();

  const targetSupplyRateWithFeeCompound = BNify(whitePaperSupplyRate).times('2102400').times('100').integerValue(BigNumber.ROUND_FLOOR);
  const supplyRatePerYear = BNify(contractSupply).times('2102400').times('100').integerValue(BigNumber.ROUND_FLOOR)

  console.log(`${BNify(supplyRatePerYear).div(one).toString()}% supplyRatePerYear`);
  console.log(`${targetSupplyRateWithFeeCompound.div(one).toString()}% targetSupplyRateWithFeeCompound per year if supplying ${BNify(totalAmount).div(one).toString()} underlying`);
  // ##### END COMPOUND

  // So ideally we should solve this one and find x1 and x:
  // (a1 * (s1 / (s1 + (n - x))) * (b1 / (s1 + (n - x))) * o1 / k1) - ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f = 0

  // ###### FULCRUM
  const targetSupplyRateWithFeeFulcrumFoo = x1 => a1.times(s1.div(s1.plus(x1)))
    .times(b1.div(s1.plus(x1)))
    .times(o1).div(k1); // counting fee (spreadMultiplier)

  // ###### COMPOUND
  const targetSupplyRateWithFeeCompoundFoo = async x => {
    const res = await whitePaperContract.methods.getSupplyRate(
      BNify(getCash).plus(BNify(x)).integerValue(BigNumber.ROUND_FLOOR).toFixed().toString(),
      BNify(totalBorrows).toFixed(),
      BNify(totalReserves).toFixed(),
      BNify(reserveFactorMantissa).toFixed()
    ).call();

    return BNify(res).times('2102400').times('100').integerValue(BigNumber.ROUND_FLOOR);
  }

  const algo = async (amount, currBestTokenAddr, bestRate, worstRate) => {
    const isCompoundBest = currBestTokenAddr === addresses.cAddress;
    let maxDAICompound;
    let maxDAIFulcrum;
    amount = BNify(amount);
    const tolerance = BNify('0.1').times(BNify('1e18')); // 0.1%

    if (isCompoundBest) {
      console.log('Trying to make all on compound...')
      if ((await targetSupplyRateWithFeeCompoundFoo(amount)).plus(tolerance).gt(worstRate)) {
        // All on Compound
        return [amount, BNify(0)];
      }
      console.log('Compound cannot sustain all the liquidity');
    } else {
      console.log('Trying to make all on fulcrum...')
      if (targetSupplyRateWithFeeFulcrumFoo(amount).plus(tolerance).gt(worstRate)) {
        console.log('all on fulcrum')
        // All on Fulcrum
        return [BNify(0), amount];
      }
      console.log('Fulcrum cannot sustain all the liquidity');
    }

    /*
      Compound: (getCash returns the available supply only, not the borrowed one)
      getCash + totalBorrows = totalSuppliedCompound

      Fulcrum:
      totalSupply = totalSuppliedFulcrum

      we try to correlate borrow and supply on both markets
      totC = totalSuppliedCompound + totalBorrowsCompound
      totF = totalSuppliedFulcrum + totalBorrowsFulcrum

      n : (totC + totF) = x : totF
      x = n * totF / (totC + totF)
    */

    console.log('Starting iterative approach');
    const amountFulcrum = amount.times(totalAssetBorrow.plus(totalAssetSupply)).div(
      totalAssetBorrow.plus(totalAssetSupply).plus(BNify(getCash).plus(totalBorrows).plus(totalBorrows))
    );
    const amountCompound = amount.minus(amountFulcrum);

    let i = 0;
    const amountSizesCalcRec = async (
      compoundAmount = amountCompound,
      fulcrumAmount = amountFulcrum,
      isCurrCompoundBest = isCompoundBest) => {
      console.log(++i);

      const fulcNewRate = targetSupplyRateWithFeeFulcrumFoo(fulcrumAmount);
      const compNewRate = await targetSupplyRateWithFeeCompoundFoo(compoundAmount);
      const isCompoundNewBest = compNewRate.gt(fulcNewRate);

      let newCompoundAmount;
      let newFulcrumAmount;
      let smallerAmount;

      console.log('DATA ######')
      console.log({
        fulcrumAmount: fulcrumAmount.div(1e18).toString(),
        compoundAmount: compoundAmount.div(1e18).toString(),
        fulcNewRate: fulcNewRate.div(1e18).toString(),
        compNewRate: compNewRate.div(1e18).toString(),
      });

      smallerAmount = fulcrumAmount.gt(compoundAmount) ? compoundAmount : fulcrumAmount;

      if (fulcNewRate.plus(tolerance).gt(compNewRate) && fulcNewRate.lt(compNewRate) ||
          (compNewRate.plus(tolerance).gt(fulcNewRate) && compNewRate.lt(fulcNewRate))) {
        return [compoundAmount, fulcrumAmount];
      }

      if (isCompoundNewBest) {
        // Compound > Fulcrum
        newFulcrumAmount = fulcrumAmount.minus(smallerAmount.div(BNify('2')));
        newCompoundAmount = compoundAmount.plus(smallerAmount.div(BNify('2')))
      } else {
        newCompoundAmount = compoundAmount.minus(smallerAmount.div(BNify('2')));
        newFulcrumAmount = fulcrumAmount.plus(smallerAmount.div(BNify('2')));
      }

      return await amountSizesCalcRec(newCompoundAmount, newFulcrumAmount, isCompoundNewBest);
    };

    let [compAmount, fulcAmount] = await amountSizesCalcRec();
    if (maxDAIFulcrum) {
      // add maxDAIFulcrum to s1
      fulcAmount = fulcAmount.plus(maxDAIFulcrum);
    }
    if (maxDAICompound) {
      // add maxDAIFulcrum to s
      compAmount = compAmount.plus(maxDAICompound);
    }

    return [compAmount, fulcAmount];
  };

  const fulcrumCurr = targetSupplyRateWithFeeFulcrumFoo(0);
  const compoundCurr = await targetSupplyRateWithFeeCompoundFoo(0);
  const currBestAddress = fulcrumCurr.gt(compoundCurr) ? addresses.iAddress : addresses.cAddress;
  const bestRate = fulcrumCurr.gt(compoundCurr) ? fulcrumCurr : compoundCurr;
  const worstRate = fulcrumCurr.gt(compoundCurr) ? compoundCurr : fulcrumCurr;

  const resAlgo = await algo(totalAmount, currBestAddress, bestRate, worstRate);
  console.log(`${resAlgo[0].div(1e18).toString()} token in compound, ${resAlgo[1].div(1e18).toString()} token fulcrum ####################`);
  const rateOfOneDAIInCToken = BNify(1e18).div(BNify(exchangeRateStored).div(1e18)).div(1e8)
  console.log(`${resAlgo[0].div(1e18).times(rateOfOneDAIInCToken).toString()} cToken generated, ${resAlgo[1].div(1e18).times(tokenPrice).div(1e18).toString()} iToken generated ####################`);
  return resAlgo;
};
async function calcAllocationsOldRateModel(newAmount, web3, addresses, cTokenContract, whitePaperContract) {
  const underlyingTokenContract = new web3.eth.Contract(IERC20, addresses.underlying);
  const idleTokenContract = new web3.eth.Contract(IdleToken, addresses.idleAddress);
  const iTokenContract = new web3.eth.Contract(iERC20Fulcrum, addresses.iAddress);
  const cTokenWithSupplyContract = new web3.eth.Contract(IERC20, addresses.cAddress);

  // Get current netAssetValue in Idle contract
  const totalAmount = await calcNAVIdle(newAmount, idleTokenContract);
  console.log(`${BNify(totalAmount).div(one).toString()} underlying value in Idle pool + newAmount`);

  // Get all data for iToken
  let promises = [
    iTokenContract.methods.supplyInterestRate().call(),
    iTokenContract.methods.avgBorrowInterestRate().call(),
    iTokenContract.methods.totalAssetSupply().call(),
    iTokenContract.methods.totalAssetBorrow().call(),
    iTokenContract.methods.spreadMultiplier().call(),
    iTokenContract.methods.nextSupplyInterestRate(totalAmount.integerValue(BigNumber.ROUND_FLOOR).toFixed()).call(),
    // iTokenContract.methods.nextSupplyInterestRate(web3.utils.toBN(totalAmount)).call(),
    iTokenContract.methods.tokenPrice().call(),
  ];

  const res = await Promise.all(promises);
  let [supplyRate, borrowRate, totalAssetSupply, totalAssetBorrow, spreadMultiplier, autoNextRate, tokenPrice] = res;

  supplyRate = BNify(supplyRate);
  borrowRate = BNify(borrowRate);
  totalAssetSupply = BNify(totalAssetSupply);
  totalAssetBorrow = BNify(totalAssetBorrow);
  spreadMultiplier = BNify(spreadMultiplier);
  autoNextRate = BNify(autoNextRate);
  tokenPrice = BNify(tokenPrice);

  const utilizationRate = BNify(totalAssetBorrow).div(BNify(totalAssetSupply));

  console.log(`CONTRACT FULCRUM current DATA:`);
  console.log(`${BNify(supplyRate).div(one).toString()}% supplyRate %`);
  console.log(`${autoNextRate.div(one).toString()}% autoNextRate if supplying ${BNify(totalAmount).div(one).toString()} underlying`);

  const a1 = borrowRate;
  const b1 = totalAssetBorrow;
  let s1 = totalAssetSupply;
  const o1 = spreadMultiplier;
  const x1 = totalAmount;
  const k1 = oneHundred;
  const currentSupplyInterestRate = a1.times(b1.div(s1));
  const targetSupplyRate = a1.times(s1.div(s1.plus(x1))).times(b1.div(s1.plus(x1)))

  const currentSupplyInterestRateWithFee = a1.times(b1.div(s1))
    .times(o1).div(k1); // counting fee (spreadMultiplier)

  // ######
  const targetSupplyRateWithFee = a1.times(s1.div(s1.plus(x1)))
    .times(b1.div(s1.plus(x1)))
    .times(o1).div(k1); // counting fee (spreadMultiplier)

  console.log(`${currentSupplyInterestRateWithFee.div(one).toString()} currentSupplyInterestRateWithFee`);
  console.log(`${targetSupplyRateWithFee.div(one).toString()} autoNextRateWithFee`);
  console.log(`############ END FULCRUM `);

  console.log(`CONTRACT COMPOUND current DATA (OLD INTEREST RATE MODEL):`);
  let promisesComp = [
    cTokenContract.methods.supplyRatePerBlock().call(),
    cTokenContract.methods.borrowRatePerBlock().call(),

    cTokenContract.methods.totalBorrows().call(),
    cTokenContract.methods.getCash().call(),
    cTokenContract.methods.totalReserves().call(),
    cTokenWithSupplyContract.methods.totalSupply().call(),
    cTokenContract.methods.reserveFactorMantissa().call(),
    cTokenContract.methods.exchangeRateStored().call(),
    whitePaperContract.methods.baseRate().call(),
    whitePaperContract.methods.multiplier().call()
  ];
  const resComp = await Promise.all(promisesComp);
  const [
    contractSupply, contractBorrow,
    totalBorrows, getCash, totalReserves, totalSupply,
    reserveFactorMantissa, exchangeRateStored,
    baseRate, multiplier
  ] = resComp;

  const supplyRatePerYear = BNify(contractSupply).times('2102400').times('100').integerValue(BigNumber.ROUND_FLOOR)
  const borrowRatePerYearContract = BNify(contractBorrow).times('2102400').times('100').integerValue(BigNumber.ROUND_FLOOR)

  const a = BNify(baseRate);
  const b = BNify(totalBorrows);
  const c = BNify(multiplier);
  const d = BNify(totalReserves);
  const e = BNify(one).minus(BNify(reserveFactorMantissa));
  let s = BNify(getCash);
  // const q = BNify(targetSupplyRate);
  const x = totalAmount;
  const k = BNify(2102400); // blocksInAYear
  const j = BNify(one); // oneEth
  const f = BNify(100);

  // q = (((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j -> to the block rate
  // q = ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f -> to get yearly rate -> this is needed

  const targetSupplyRateWithFeeCompound = a.plus(b.times(c).div(b.plus(s).plus(x))).div(k).times(e).times(b).div(
      s.plus(x).plus(b).minus(d)
    ).div(j).times(k).times(f).integerValue(BigNumber.ROUND_FLOOR) // to get the yearly rate

  console.log(`${BNify(supplyRatePerYear).div(one).toString()}% supplyRatePerYear`);
  console.log(`${targetSupplyRateWithFeeCompound.div(one).toString()} targetSupplyRateWithFeeCompound per year if supplying ${BNify(totalAmount).div(one).toString()} underlying`);
  // ##### END COMPOUND

  // So ideally we should solve this one and find x1 and x:
  // (a1 * (s1 / (s1 + (n - x))) * (b1 / (s1 + (n - x))) * o1 / k1) - ((((a + (b*c)/(b + s + x)) / k) * e * b / (s + x + b - d)) / j) * k * f = 0

  // ###### FULCRUM
  const targetSupplyRateWithFeeFulcrumFoo = x1 => a1.times(s1.div(s1.plus(x1)))
    .times(b1.div(s1.plus(x1)))
    .times(o1).div(k1); // counting fee (spreadMultiplier)

  // ###### COMPOUND
  const targetSupplyRateWithFeeCompoundFoo = x => a.plus(b.times(c).div(b.plus(s).plus(x))).div(k).times(e).times(b).div(
      s.plus(x).plus(b).minus(d)
    ).div(j).times('2102400').times('100').integerValue(BigNumber.ROUND_FLOOR);

  const algo = (amount, currBestTokenAddr, bestRate, worstRate) => {
    const isCompoundBest = currBestTokenAddr === cTokenContract.address;
    let maxDAICompound;
    let maxDAIFulcrum;
    amount = BNify(amount);
    const tolerance = BNify('0.1').times(BNify('1e18')); // 0.1%

    if (isCompoundBest) {
      console.log('Trying to make all on compound...')
      if (targetSupplyRateWithFeeCompoundFoo(amount).plus(tolerance).gt(worstRate)) {
        // All on Compound
        return [amount, BNify(0)];
      }
      console.log('Compound cannot sustain all the liquidity');
    } else {
      console.log('Trying to make all on fulcrum...')
      if (targetSupplyRateWithFeeFulcrumFoo(amount).plus(tolerance).gt(worstRate)) {
        console.log('all on fulcrum')
        // All on Fulcrum
        return [BNify(0), amount];
      }
      console.log('Fulcrum cannot sustain all the liquidity');
    }

    /*
      Compound: (getCash returns the available supply only, not the borrowed one)
      getCash + totalBorrows = totalSuppliedCompound

      Fulcrum:
      totalSupply = totalSuppliedFulcrum

      we try to correlate borrow and supply on both markets
      totC = totalSuppliedCompound + totalBorrowsCompound
      totF = totalSuppliedFulcrum + totalBorrowsFulcrum

      n : (totC + totF) = x : totF
      x = n * totF / (totC + totF)
    */

    console.log('Starting iterative approach');
    const amountFulcrum = amount.times(totalAssetBorrow.plus(totalAssetSupply)).div(
      totalAssetBorrow.plus(totalAssetSupply).plus(BNify(getCash).plus(totalBorrows).plus(totalBorrows))
    );
    const amountCompound = amount.minus(amountFulcrum);

    let i = 0;
    const amountSizesCalcRec = (
      compoundAmount = amountCompound,
      fulcrumAmount = amountFulcrum,
      isCurrCompoundBest = isCompoundBest) => {
      console.log(++i);

      const fulcNewRate = targetSupplyRateWithFeeFulcrumFoo(fulcrumAmount);
      const compNewRate = targetSupplyRateWithFeeCompoundFoo(compoundAmount);
      const isCompoundNewBest = compNewRate.gt(fulcNewRate);

      let newCompoundAmount;
      let newFulcrumAmount;
      let smallerAmount;

      console.log('DATA ######')
      console.log({
        fulcrumAmount: fulcrumAmount.div(one).toString(),
        compoundAmount: compoundAmount.div(one).toString(),
        fulcNewRate: fulcNewRate.div(one).toString(),
        compNewRate: compNewRate.div(one).toString(),
      });

      smallerAmount = fulcrumAmount.gt(compoundAmount) ? compoundAmount : fulcrumAmount;

      if (fulcNewRate.plus(tolerance).gt(compNewRate) && fulcNewRate.lt(compNewRate) ||
          (compNewRate.plus(tolerance).gt(fulcNewRate) && compNewRate.lt(fulcNewRate))) {
        return [compoundAmount, fulcrumAmount];
      }

      if (isCompoundNewBest) {
        // Compound > Fulcrum
        newFulcrumAmount = fulcrumAmount.minus(smallerAmount.div(BNify('2')));
        newCompoundAmount = compoundAmount.plus(smallerAmount.div(BNify('2')))
      } else {
        newCompoundAmount = compoundAmount.minus(smallerAmount.div(BNify('2')));
        newFulcrumAmount = fulcrumAmount.plus(smallerAmount.div(BNify('2')));
      }

      return amountSizesCalcRec(newCompoundAmount, newFulcrumAmount, isCompoundNewBest);
    };

    let [compAmount, fulcAmount] = amountSizesCalcRec();
    if (maxDAIFulcrum) {
      // add maxDAIFulcrum to s1
      fulcAmount = fulcAmount.plus(maxDAIFulcrum);
    }
    if (maxDAICompound) {
      // add maxDAIFulcrum to s
      compAmount = compAmount.plus(maxDAICompound);
    }

    return [compAmount, fulcAmount];
  };

  const fulcrumCurr = targetSupplyRateWithFeeFulcrumFoo(0);
  const compoundCurr = targetSupplyRateWithFeeCompoundFoo(0);
  const currBestAddress = fulcrumCurr.gt(compoundCurr) ? iTokenContract.address : cTokenContract.address;
  const bestRate = fulcrumCurr.gt(compoundCurr) ? fulcrumCurr : compoundCurr;
  const worstRate = fulcrumCurr.gt(compoundCurr) ? compoundCurr : fulcrumCurr;

  const resAlgo = algo(totalAmount, currBestAddress, bestRate, worstRate);
  console.log(`${resAlgo[0].div(one).toString()} DAI in compound, ${resAlgo[1].div(one).toString()} DAI fulcrum ####################`);
  // const rateOfOneDAIInCToken = BNify(one).div(BNify(exchangeRateStored).div(one)).div(1e8)
  // console.log(`${resAlgo[0].div(one).times(rateOfOneDAIInCToken).toString()} cToken generated, ${resAlgo[1].div(one).times(tokenPrice).div(one).toString()} iToken generated ####################`);
  return resAlgo;
};

module.exports = async function calculateAllocations(newAmount, web3, addresses) {
  const cTokenContract = new web3.eth.Contract(CERC20, addresses.cAddress);
  const whitePaperContract = new web3.eth.Contract(WhitePaperInterestRateModel, await cTokenContract.methods.interestRateModel().call());

  let hasOldModel;
  try {
    await whitePaperContract.methods.baseRate().call();
    hasOldModel = true;
  } catch (e) {
    hasOldModel = false;
  }

  if (hasOldModel) {
    return calcAllocationsOldRateModel(newAmount, web3, addresses, cTokenContract, whitePaperContract);
  }
  return calcAllocationsNewRateModel(newAmount, web3, addresses, cTokenContract, whitePaperContract);
};
