import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import * as fs from 'fs';


const app = express();

const { privatekey } = JSON.parse(fs.readFileSync(".secret").toString().trim());

const data = {
  WBNB: '0x1133daa3553a5f29bb2838C9ddfE38D1E1c592E9', //wbnb
  to_PURCHASE: '0xCe420292B9Db4f6a7e46D2144A81B332F9B0D8BC',  // token to purchase = BUSD for test
  factory: '0x4fcEd72290D3337b20F214b2De6dd4974bB75Af2',  //PancakeSwap V2 factory
  router: '0xcd147E2C00f7262067145CF196d39545aed4015E', //PancakeSwap V2 router
  recipient: '0xbED1440D52544C0143810AA039981F3fF5B35f4F', //wallet address,
  AMOUNT_OF_WBNB : '0.01',
  Slippage : '3', //in Percentage
  gasPrice : '10', //in gwei
  gasLimit : '200000' //at least 21000
}

let initialLiquidityDetected = false;
console.log('privatekey',privatekey)
// Connect a wallet to mainnet
const bscTestnetUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545'
let provider = new ethers.providers.JsonRpcProvider(bscTestnetUrl);
// let walletWithProvider = new ethers.Wallet(privatekey);
let wallet = new ethers.Wallet(privatekey);

const bscMainnetUrl = 'https://bsc-dataseed.binance.org/'
const mnemonic = '';
// const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const account = wallet.connect(provider);

const factory = new ethers.Contract(
  data.factory,
  ['function getPair(address tokenA, address tokenB) external view returns (address pair)'],
  account
);

const router = new ethers.Contract(
  data.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
);

const run = async () => {
  const tokenIn = data.WBNB;
  const tokenOut = data.to_PURCHASE;
  const pairAddress = await factory.getPair(tokenIn, tokenOut);

  console.log(pairAddress);

  const pair = new ethers.Contract(pairAddress, ['event Mint(address indexed sender, uint amount0, uint amount1)'], account);

  pair.on('Mint', async (sender, amount0, amount1) => {
    if(initialLiquidityDetected === true) {
        return;
    }

    initialLiquidityDetected = true;

   //We buy x amount of the new token for our wbnb
   const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_WBNB}`, 'ether');
   const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
 
   //Our execution price will be a bit different, we need some flexbility
   const amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`)); 
 
   console.log(
    chalk.green.inverse(`Liquidity Addition Detected\n`)
     +
     `Buying Token
     =================
     tokenIn: ${amountIn.toString()} ${tokenIn} (WBNB)
     tokenOut: ${amountOutMin.toString()} ${tokenOut}
   `);

   console.log('Processing Transaction.....');
   console.log(chalk.yellow(`amountIn: ${amountIn}`));
   console.log(chalk.yellow(`amountOutMin: ${amountOutMin}`));
   console.log(chalk.yellow(`tokenIn: ${tokenIn}`));
   console.log(chalk.yellow(`tokenOut: ${tokenOut}`));
   console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
   console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
   console.log(chalk.yellow(`data.gasPrice: ${ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')}`));

   const tx = await router.swapExactTokensForTokens(
     amountIn,
     amountOutMin,
     [tokenIn, tokenOut],
     data.recipient,
     Date.now() + 1000 * 60 * 10, //10 minutes
     {
       'gasLimit': data.gasLimit,
       'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')
   });
 
   const receipt = await tx.wait(); 
   console.log('Transaction receipt');
   console.log(receipt);
  });
}

run();

const PORT = 5000;

app.listen(PORT, (console.log(chalk.yellow(`Listening for Liquidity Addition to token ${data.to_PURCHASE}`))));
