require('@nomicfoundation/hardhat-ethers');

module.exports = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      accounts: [
        `0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e`
      ],
    },
  },
};
