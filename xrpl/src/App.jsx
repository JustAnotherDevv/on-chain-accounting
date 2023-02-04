import { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import {
  Client,
  getBalanceChanges,
  rippleTimeToISOTime,
  rippleTimeToUnixTime,
} from "xrpl";

// Accounts used for testing
// raFS9KAB6ay6k6uvPY961C93dhUeXY2MJB
// rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn
// rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe

async function getBatchAccountTx(address, taxon) {
  try {
    if (!address)
      throw new Error(
        `You need to provide proper XRPL address to sue this function`
      );
    const client = new Client("wss://xrplcluster.com");
    await client.connect();
    let txs = await client.request({
      method: "account_tx",
      account: address,
    });
    let accountTxs = txs.result.transactions;
    for (;;) {
      if (txs["result"]["marker"] === undefined) {
        break;
      } else {
        txs = await client.request({
          method: "account_tx",
          account: address,
          marker: txs["result"]["marker"],
        });
        accountTxs = accountTxs.concat(txs.result.transactions);
      }
    }
    client.disconnect();
    if (taxon) return accountTxs.filter((a) => a.NFTokenTaxon == taxon);
    return accountTxs;
  } catch (error) {
    console.error(error);
    return error;
  }
}

function App() {
  const [sendingAddress, setSendingAddress] = useState("");
  const [receivingAddress, setReceivingAddress] = useState(
    "rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn"
  );
  const [sourceTag, setSourceTag] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [fromDate, setFromDate] = useState(""); //("2022-01-01");
  const [toDate, setToDate] = useState(""); //("2022-11-01");
  const [asset, setAsset] = useState("XRP");
  const [orderBy, setOrderBy] = useState("newest"); // oldest // newest
  const [txType, setTxType] = useState("Payment");

  const formatTransactions = (transactions, address) => {
    let formattedTransactions = [];
    if (transactions) {
      // console.log(transactions.length);
      transactions.forEach((r, rIndex) => {
        const { tx, meta } = r;
        let direction = "other";
        if (tx?.Account === address) direction = "sent";
        if (tx?.Destination === address) direction = "received";
        const from = !tx?.Account ? " " : `${tx?.Account}`;
        const to = !tx?.Destination ? "XRPL" : `${tx?.Destination}`;
        if (tx?.Destination === address) direction = "received";
        const moment = new Date((tx.date + 946684800) * 1000).toISOString();
        const balanceChanges = getBalanceChanges(meta);
        // console.log(balanceChanges);
        let isAddressIncluded = false;
        let thisAddresIndex;
        balanceChanges.forEach((e, i) => {
          if (e.account == address) {
            isAddressIncluded = true;
            thisAddresIndex = i;
          }
        });
        if (isAddressIncluded) {
          const mutations = balanceChanges[thisAddresIndex].balances;
          mutations.forEach((mutation) => {
            const currency = !mutation.issuer
              ? "XRP"
              : `${mutation.issuer}.${mutation.currency}`;

            const isFee =
              direction === "sent" &&
              Number(mutation.value) * -1 * 1000000 === Number(tx?.Fee)
                ? 1
                : 0;

            const fee =
              direction === "sent" ? (Number(tx?.Fee) / 1000000) * -1 : 0;

            if (
              (asset == mutation.currency && asset.length != 0) ||
              asset.length == 0
            )
              formattedTransactions.push({
                // ledger: tx.ledger_index,
                // direction: direction,
                date: moment,
                from: from,
                to: to,
                // txtype: tx.TransactionType,
                asset: currency,
                amount: mutation.value,
                // is_fee: isFee,
                // fee: fee,
                txHash: tx.hash,
                link: `https://bithomp.com/${tx.hash}`,
                // _tx: returnTx ? tx : undefined,
                // _meta: returnTx ? meta : undefined,
              });
          });
        }
      });
    }
    return formattedTransactions;
  };

  async function filterTransactions(transactions) {
    let filteredTransactions = transactions;
    // Checking if sender matches sending address
    if (sendingAddress.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.Account == sendingAddress
      );
    // Checking if destination matches receving address
    if (receivingAddress.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.Destination == receivingAddress
      );
    // Filtering for selected tx type
    if (txType.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.TransactionType == txType
      );
    // Ordering by newest or oldest tx
    if (orderBy == "oldest")
      filteredTransactions = await filteredTransactions.reverse();
    // Filtering for tx that are newer than `fromDate`
    if (fromDate.length != 0)
      filteredTransactions = await filteredTransactions.filter((tx) => {
        // const moment = new Date((tx.tx.date + 946684800) * 1000).toISOString();
        const moment = rippleTimeToISOTime(tx.tx.date);
        const fromDateFormatted = new Date(fromDate).toISOString();
        console.log();
        // console.log(fromDateFormatted);
        return moment >= fromDateFormatted;
      });
    // Filtering for tx that are older than `toDate`
    if (toDate.length != 0)
      filteredTransactions = await filteredTransactions.filter((tx) => {
        const moment = new Date((tx.tx.date + 946684800) * 1000).toISOString();
        const toDateFormatted = new Date(toDate).toISOString();
        return moment < toDateFormatted;
      });
    // Filtering for tx that contain matching SourceTag
    if (sourceTag.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.SourceTag == sourceTag
      );
    // Filtering for tx that contain matching DestinationTag
    if (destinationTag.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.DestinationTag == destinationTag
      );
    return filteredTransactions;
  }

  useEffect(() => {
    (async () => {
      console.log(
        await getBatchAccountTx("rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn")
      );
      console.log(
        await filterTransactions(
          await getBatchAccountTx("rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn")
        )
      );
      console.log(
        formatTransactions(
          await filterTransactions(
            await getBatchAccountTx("rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn")
          ),
          "rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn"
        )
      );
    })();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <p>On-chain accounting with xrpl.js</p>
      </header>
    </div>
  );
}

export default App;
