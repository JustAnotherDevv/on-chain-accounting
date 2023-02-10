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

async function getBatchAccountTx(address) {
  try {
    if (!address || address.length == 0)
      throw new Error(
        `You need to provide proper XRPL address to use this function`
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
    return accountTxs;
  } catch (error) {
    console.error(error);
    // return error;
    return [];
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
  const [customAsset, setCustomAsset] = useState("");

  const formatTransactions = (transactions, address, secondAddress) => {
    let formattedTransactions = [];
    if (transactions) {
      // console.log(transactions.length);
      transactions.forEach((r, rIndex) => {
        const { tx, meta } = r;
        let direction = "other";
        // if (tx?.Account === address) direction = "sent";
        // if (tx?.Destination === address) direction = "received";
        const from = !tx?.Account ? " " : `${tx?.Account}`;
        const to = !tx?.Destination ? "XRPL" : `${tx?.Destination}`;
        // if (tx?.Destination === address) direction = "received";
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
        let isSecondAddressIncluded = false;
        let thisSecondAddresIndex;
        balanceChanges.forEach((e, i) => {
          if (e.account == secondAddress) {
            isAddressIncluded = true;
            thisAddresIndex = i;
          }
        });
        if (isAddressIncluded || isSecondAddressIncluded) {
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
              asset.length == 0 ||
              (!mutation.issuer && asset == "XRP") ||
              (asset == "custom" && customAsset == mutation.currency)
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
    console.log(filteredTransactions.length);
    // Removing failed txs
    filteredTransactions = await filteredTransactions.filter(
      (tx) => tx.meta.TransactionResult == "tesSUCCESS"
    );
    console.log(filteredTransactions.length);
    // Checking if sender matches sending address
    if (sendingAddress.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.Account == sendingAddress
      );
    console.log(filteredTransactions.length);
    // Checking if destination matches receving address
    if (receivingAddress.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.Destination == receivingAddress
      );
    console.log(filteredTransactions.length);
    // Filtering for selected tx type
    if (txType.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.TransactionType == txType
      );
    console.log(filteredTransactions.length);
    // Ordering by newest or oldest tx
    if (orderBy == "oldest")
      filteredTransactions = await filteredTransactions.reverse();
    console.log(filteredTransactions.length);
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
    console.log(filteredTransactions.length);
    // Filtering for tx that are older than `toDate`
    if (toDate.length != 0)
      filteredTransactions = await filteredTransactions.filter((tx) => {
        const moment = new Date((tx.tx.date + 946684800) * 1000).toISOString();
        const toDateFormatted = new Date(toDate).toISOString();
        return moment < toDateFormatted;
      });
    console.log(filteredTransactions.length);
    // Filtering for tx that contain matching SourceTag
    if (sourceTag.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.SourceTag == sourceTag
      );
    console.log(filteredTransactions.length);
    // Filtering for tx that contain matching DestinationTag
    if (destinationTag.length != 0)
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.DestinationTag == destinationTag
      );
    return filteredTransactions;
  }

  async function RequestTransactions() {
    let sendingTx = [];
    if (receivingAddress.length == 0 || !receivingAddress)
      sendingTx = await getBatchAccountTx(sendingAddress);
    let receivingTx = [];
    if (sendingTx.length == 0)
      receivingTx = await getBatchAccountTx(receivingAddress);
    const batchTx = sendingTx.concat(receivingTx);

    const filteredTx = await filterTransactions(batchTx);

    const finalFormatted = await formatTransactions(
      filteredTx,
      receivingAddress,
      sendingAddress
      // "rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn"
    );

    setTxResponse(finalFormatted);

    console.log(
      sendingTx,
      "\n",
      receivingTx,
      "\n",
      batchTx,
      "\n",
      filteredTx,
      "\n",
      finalFormatted,
      "\n"
    );

    console.log(
      `${sendingTx.length}\n${receivingTx.length}\n${batchTx.length}\n${filteredTx.length}\n${finalFormatted.length}\n`
    );

    sendingTx.forEach((e, i) => {
      if (e.tx.Destination == receivingAddress) {
        console.log("first: ", e.tx.hash);
        // console.log(e.tx);
      }
    });

    receivingTx.forEach((e, i) => {
      if (e.tx.Account == sendingAddress) {
        console.log("second: ", e.tx.hash);
        // console.log(e.tx);
      }
    });
  }

  const assets = [
    "5065617300000000000000000000000000000000",
    "426F72656450616E646173000000000000000000",
    "YOL",
    "4C4F564500000000000000000000000000000000",
    "RDX",
    "GCB",
    "LUC",
    "CCB",
    "5041534100000000000000000000000000000000",
    "4661744361740000000000000000000000000000",
    "KAT",
    "5852504C33444150455300000000000000000000",
    "3344415045530000000000000000000000000000",
    "584C45474F000000000000000000000000000000",
    "4D4F4E54455A554D410000000000000000000000",
    "USD",
    "4C49464500000000000000000000000000000000",
    "4C47425000000000000000000000000000000000",
    "XGC",
    "FSE",
    "576561706F6E5800000000000000000000000000",
    "TRI",
    "XDX",
    "54696B546F6B656E000000000000000000000000",
    "5852536F66747761726500000000000000000000",
    "LXA",
    "BRL",
    "SEC",
    "58314F4E45000000000000000000000000000000",
    "CCN",
    "58474F4C46000000000000000000000000000000",
    "5853686962616E75000000000000000000000000",
    "CNY",
    "DRT",
    "5847424C00000000000000000000000000000000",
    "58464C4F4B490000000000000000000000000000",
    "JPY",
    "504F4C4943450000000000000000000000000000",
    "XMS",
    "4C696C3200000000000000000000000000000000",
    "GVC",
    "CX1",
    "524F4F5453000000000000000000000000000000",
    "534F4C4F00000000000000000000000000000000",
    "XWM",
    "7848756C6B000000000000000000000000000000",
    "EGL",
    "JTK",
    "7850756700000000000000000000000000000000",
    "7850697A7A610000000000000000000000000000",
    "466C756666000000000000000000000000000000",
    "53696D6261585250000000000000000000000000",
    "7852616262697400000000000000000000000000",
    "FRD",
    "CAD",
    "78546F61647A0000000000000000000000000000",
    "63727970746F706F6B65636F696E000000000000",
    "50414C454F434F494E0000000000000000000000",
    "ELS",
    "DFI",
    "466F464600000000000000000000000000000000",
    "5363686F6F6C50756E6B73000000000000000000",
    "4368616D696C6C696F6E73000000000000000000",
    "5377697373546563680000000000000000000000",
    "434F524500000000000000000000000000000000",
    "INT",
    "PRH",
    "4E49434500000000000000000000000000000000",
    "4665646F73000000000000000000000000000000",
    "WQZ",
    "XZV",
    "5442424F42000000000000000000000000000000",
    "5465646479426F79730000000000000000000000",
    "ADA",
    "ELF",
    "ALV",
    "42756D437261636B000000000000000000000000",
    "56494F4C49545900000000000000000000000000",
    "4352494D45000000000000000000000000000000",
    "BTC",
    "4E454B4153484900000000000000000000000000",
    "4368656574616800000000000000000000000000",
    "5351554952540000000000000000000000000000",
    "ETC",
    "AIR",
    "53535445414D0000000000000000000000000000",
    "PGN",
    "585273616974616D610000000000000000000000",
    "DKP",
    "mXm",
    "XGA",
    "58506172726F7400000000000000000000000000",
    "INT",
    "99D",
    "58524C5A00000000000000000000000000000000",
    "BTC",
    "53414E746F6B656E000000000000000000000000",
    "4242756C6C646F67650000000000000000000000",
    "41544D5400000000000000000000000000000000",
    "446576546F6B656E000000000000000000000000",
  ];

  const listItems = txResponse.map((i, index) => (
    <tr className="hover self-center center" key={index}>
      <td className="">{i.date}</td>
      <td className="">{i.from}</td>
      <td className="">{i.to}</td>
      <td className="">{i.asset}</td>
      <td className="">{i.amount}</td>
      <td className="">{i.txHash.substr(0, 8 - 1)}...</td>
      <td className="mt-1">
        <button className="btn btn-sm btn-success">
          <a href={`${i.link}`} target="_blank">
            View on Bithomp
          </a>
        </button>
      </td>
    </tr>
  ));

  function OperatorsList() {
    return (
      <div className="place-items-center mt-20 flex flex-col items-center">
        <table className="table">
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
    );
  }

  function assetOptions() {
    return assets.map((a) => {
      return <option value={a}>{a}</option>;
    });
  }

  useEffect(() => {
    (async () => {})();
  }, []);

  return (
    <div className="min-w-screen">
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
              <span> Transaction type</span>
              <select
                className="select select-bordered w-full"
                onChange={(event) => setTxType(event.target.value)}
              >
                <option value="">All</option>
                <option value="Payment">Payment</option>
                <option value="NFTokenAcceptOffer">NFTokenAcceptOffer</option>
              </select>
            </label>
            <label className="w-full">
              <span>Asset</span>
              <select
                className="select select-bordered w-full"
                onChange={(event) => setAsset(event.target.value)}
              >
                <option value="">All assets</option>
                <option value="XRP">XRP</option>
                {assetOptions()}
                <option value="custom">Custom</option>
              </select>
            </label>
          </div>
          <div className=" p-4 ml-5 flex flex-col gap-8 items-start">
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
            <label className={`w-full ${asset == "custom" ? "" : "hidden"}`}>
              <span>Custom currency code</span>
              <input
                type="text"
                placeholder="All assets"
                className="input input-bordered w-full"
                value={customAsset}
                onChange={(event) => setCustomAsset(event.target.value)}
              />
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
        {txResponse.lenght == 0 ? (
          <div className="self-center">
            <p>{"loading..."}</p>
          </div>
        ) : (
          <OperatorsList />
        )}
      </div>
    </div>
  );
}

export default App;
