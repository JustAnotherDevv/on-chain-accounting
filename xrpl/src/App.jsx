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
  const [asset, setAsset] = useState("");
  const [orderBy, setOrderBy] = useState("newest"); // oldest // newest
  const [txType, setTxType] = useState("Payment");
  const [txResponse, setTxResponse] = useState([]);

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

  async function RequestTransactions() {
    setTxResponse(
      formatTransactions(
        await filterTransactions(
          await getBatchAccountTx("rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn")
        ),
        "rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn"
      )
    );
  }

  const listItems = txResponse.map((i, index) => (
    <tr className="hover self-center center" key={index}>
      <td className="">{i.date}</td>
      <td className="">{i.from}</td>
      <td className="">{i.to}</td>
      <td className="">{i.asset}</td>
      <td className="">{i.amount}</td>
      <td className="">{i.txHash.substr(0, 8 - 1)}...</td>
      <td className="mt-1">
        <button
          className="btn btn-sm btn-success"
          onClick={() => updateGreeting(i.stakeOperatorId.toString())}
        >
          <a href={`${i.link}`} target="_blank">
            View on Bithomp
          </a>
        </button>
      </td>
    </tr>
  ));

  function OperatorsList() {
    return (
      <div>
        <div className="overflow-hidden grid place-items-center mt-20">
          <table className="table w-1/2">
            <thead>
              <tr>
                <th className="bg-success text-gray-800">Date</th>
                <th className="bg-success text-gray-800">From</th>
                <th className="bg-success text-gray-800">To</th>
                <th className="bg-success text-gray-800">Asset</th>
                <th className="bg-success text-gray-800">Amount</th>
                <th className="bg-success text-gray-800">Transaction hash</th>
                <th className="bg-success text-gray-800">Bithomp link</th>
              </tr>
            </thead>
            <tbody>{!txResponse ? "Loading…" : listItems}</tbody>
          </table>
        </div>
      </div>
    );
  }

  useEffect(() => {
    (async () => {})();
  }, []);

  return (
    <div className="w-screen overflow-hidden">
      <div className="flex flex-col items-center p-5">
        <p className="text-6xl font-bold mt-12 mb-6 text-success">
          On-chain accounting with xrpl.js
        </p>
        <div className="flex p-10 w-full justify-center">
          <div className="p-4 mr-5 flex flex-col gap-8 items-end">
            <label className="w-full">
              <span>Sending Address</span>
              <input
                type="text"
                placeholder=""
                className="input input-bordered w-full"
                value={sendingAddress}
                onChange={(event) => setSendingAddress(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>Source Tag</span>
              <input
                type="text"
                placeholder=""
                className="input input-bordered w-full"
                value={sourceTag}
                onChange={(event) => setSourceTag(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>From Date</span>
              <input
                type="date"
                placeholder=""
                className="input input-bordered w-full"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>Asset</span>
              <input
                type="text"
                placeholder="All assets"
                className="input input-bordered w-full"
                value={asset}
                onChange={(event) => setAsset(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span> Transaction type</span>
              <input
                type="text"
                placeholder=""
                className="input input-bordered w-full"
                value={txType}
                onChange={(event) => setTxType(event.target.value)}
              />
            </label>
          </div>
          <div className=" p-4 ml-5 flex flex-col gap-8  items-start">
            <label className="w-full">
              <span>Receiving Address</span>
              <input
                type="text"
                placeholder=""
                className="input input-bordered w-full"
                value={receivingAddress}
                onChange={(event) => setReceivingAddress(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>Destination Tag</span>
              <input
                type="text"
                placeholder=""
                className="input input-bordered w-full"
                value={destinationTag}
                onChange={(event) => setDestinationTag(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>To Date</span>
              <input
                type="date"
                placeholder=""
                className="input input-bordered w-full"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>Order by</span>
              <select
                className="select select-bordered w-full"
                onChange={(e) => setOrderBy(e.target.value)}
              >
                <option>newest</option>
                <option>oldest</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <button
            className="btn btn-success rounded-lg shadow-md"
            onClick={() => RequestTransactions()}
          >
            Submit
          </button>
        </div>
        {!txResponse ? (
          <div className="self-center">
            <p>{txResponse.length}</p>
          </div>
        ) : (
          <OperatorsList />
        )}
      </div>
    </div>
  );
}

export default App;
