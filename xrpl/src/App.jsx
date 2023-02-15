import { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import {
  Client,
  getBalanceChanges,
  rippleTimeToISOTime,
  rippleTimeToUnixTime,
} from "xrpl";
import { CSVLink, CSVDownload } from "react-csv";

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
      console.log(accountTxs.length);
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
  const [sendingAddress, setSendingAddress] = useState(
    "rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn"
  );
  const [direction, setDirection] = useState("both");
  const [sourceTag, setSourceTag] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [fromDate, setFromDate] = useState(""); //("2022-01-01");
  const [toDate, setToDate] = useState(""); //("2022-11-01");
  const [asset, setAsset] = useState("");
  const [orderBy, setOrderBy] = useState("newest"); // oldest // newest
  const [txType, setTxType] = useState("");
  const [txResponse, setTxResponse] = useState([]);
  const [customAsset, setCustomAsset] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [csvData, setCsvData] = useState([
    [
      "Date",
      "From",
      "To",
      "Asset",
      "Amount",
      "Transaction hash",
      "Bithomp link",
    ],
  ]);

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
        // let thisSecondAddresIndex;
        balanceChanges.forEach((e, i) => {
          if (e.account == secondAddress) {
            isAddressIncluded = true;
            thisAddresIndex = i;
          }
        });
        if (isAddressIncluded || isSecondAddressIncluded) {
          const mutations = balanceChanges[thisAddresIndex].balances;
          mutations.forEach((mutation) => {
            let assetToDisplay = assets.find((e) => e[1] == mutation.currency);
            if (!assetToDisplay) {
              assetToDisplay = `${mutation.currency}`;
            } else {
              assetToDisplay = assetToDisplay[0];
            }
            const currency = !mutation.issuer
              ? "XRP"
              : // : `${mutation.issuer}.${mutation.currency}`;
                `${assetToDisplay}`;

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
    if (sendingAddress.length != 0 && direction == "sent")
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.Account == sendingAddress
      );
    console.log(filteredTransactions.length);
    // Checking if destination matches receving address
    if (sendingAddress.length != 0 && direction == "received")
      filteredTransactions = await filteredTransactions.filter(
        (tx) => tx.tx.Destination == sendingAddress
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
        // console.log();
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
    console.log(filteredTransactions.length);
    return filteredTransactions;
  }

  async function RequestTransactions() {
    setIsFetching(true);
    let sendingTx = [];
    // if (receivingAddress.length == 0 || !receivingAddress)
    sendingTx = await getBatchAccountTx(sendingAddress);
    // if (sendingTx.length == 0)
    //   receivingTx = await getBatchAccountTx(receivingAddress);
    // const batchTx = sendingTx.concat(receivingTx);

    const filteredTx = await filterTransactions(sendingTx);

    const finalFormatted = await formatTransactions(
      filteredTx,
      sendingAddress,
      sendingAddress
      // "rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn"
    );

    setTxResponse(finalFormatted);

    console.log(sendingTx, "\n", filteredTx, "\n", finalFormatted, "\n");

    console.log(
      `${sendingTx.length}\n${filteredTx.length}\n${finalFormatted.length}\n`
    );

    let tempCsvData = csvData;

    finalFormatted.forEach((tx) => {
      tempCsvData.push([
        `${tx.date.toString()}`,
        `${tx.from.toString()}`,
        `${tx.to.toString()}`,
        `${tx.asset.toString()}`,
        `${tx.amount.toString()}`,
        `${tx.txHash.toString()}`,
        `${tx.link.toString()}`,
      ]);
    });

    setCsvData(tempCsvData);

    setIsFetching(false);
  }

  const assets = [
    ["XRPL ETF $XRPLedgerETF", "245852504C656467657245544600000000000000"],
    ["1MarketCoin 1MC", "1MC"],
    ["XRPL 3DApes 3DAPES", "3344415045530000000000000000000000000000"],
    ["Anbu Legends ANBU", "414E425500000000000000000000000000000000"],
    ["Arcade X ArcX", "4172635800000000000000000000000000000000"],
    ["ARK", "ARK"],
    ["ASC", "ASC"],
    ["Bored Apes XRP Club BAY", "BAY"],
    ["Bored Apes XRP Club BAYNANA", "4241594E414E4100000000000000000000000000"],
    ["GateHub Fifth BCH", "BCH"],
    ["BPM Wallet BPM", "BPM"],
    ["GateHub BTC", "BTC"],
    ["Bitstamp BTC", "BTC"],
    ["Ripple Fox CNY", "CNY"],
    ["Coreum CORE", "434F524500000000000000000000000000000000"],
    ["CasinoCoin CSC", "CSC"],
    ["Elysian ELS", "ELS"],
    [
      "Equilibrium Games Equilibrium",
      "457175696C69627269756D000000000000000000",
    ],
    ["GateHub Fifth ETH", "ETH"],
    ["Ripple Fox ETH", "ETH"],
    ["GateHub EUR", "EUR"],
    ["Unflake FKM", "FKM"],
    ["GateHub Fifth FLR", "FLR"],
    ["FURY", "4655525900000000000000000000000000000000"],
    ["GBP", "GBP"],
    ["gLUC", "674C554300000000000000000000000000000000"],
    ["Greyhound Greyhound", "47726579686F756E640000000000000000000000"],
    ["GreenZone GZX", "GZX"],
    ["HadaNFT HADA", "4841444100000000000000000000000000000000"],
    ["Happy Cats HCATS", "4843415453000000000000000000000000000000"],
    ["Bored Apes XRP Club HOG", "HOG"],
    ["iHunt4 IGC", "IGC"],
    ["XRP Junkies JUNK", "4A554E4B00000000000000000000000000000000"],
    ["LOX Network LOX", "LOX"],
    ["Lucretius LUC", "LUC"],
    ["Limited Currency LUSD", "4C55534400000000000000000000000000000000"],
    ["MAG", "MAG"],
    ["Nerian Network Nerian", "4E657269616E0000000000000000000000000000"],
    ["NFT Pawn King NPK", "NPK"],
    ["OnChain Whales OCW", "OCW"],
    ["OVO", "OVO"],
    ["onXRP OVX", "OVX"],
    ["onXRP OXP", "OXP"],
    ["Pixel Ape Rowboat Club PARC", "5041524300000000000000000000000000000000"],
    ["D.P.Monks Finance RDX", "RDX"],
    ["The Reaper RPR", "RPR"],
    ["Sanctum", "53616E6374756D00000000000000000000000000"],
    ["Schmeckles Schmeckles", "5363686D65636B6C657300000000000000000000"],
    ["SuperEagle Coin SEC", "SEC"],
    ["GateHub SGB", "SGB"],
    ["ShibaNFT ShibaNFT", "53686962614E4654000000000000000000000000"],
    ["Sologenic SOLO", "534F4C4F00000000000000000000000000000000"],
    ["Unflake SSM", "SSM"],
    ["StaykX  STX", "STX"],
    ["SwiftTech SwissTech", "5377697373546563680000000000000000000000"],
    ["Tipper TPR", "TPR"],
    ["Treasury TRSRY", "5452535259000000000000000000000000000000"],
    ["Teleport TSX", "TSX"],
    ["Unflake UFm", "UFm"],
    ["GateHub USD", "USD"],
    ["Bitstamp USD", "USD"],
    ["Ripple Fox USD", "USD"],
    ["USD", "USD"],
    ["GateHub USDC USDC", "5553444300000000000000000000000000000000"],
    ["USDM", "5553444D00000000000000000000000000000000"],
    ["GateHub USDT USDT", "5553445400000000000000000000000000000000"],
    ["Treasury UtiliteX", "5574696C69746558000000000000000000000000"],
    ["Vagabond VGB VGB", "VGB"],
    ["xAliens xAliens", "78416C69656E7300000000000000000000000000"],
    ["Xscape XBLADE", "58424C4144450000000000000000000000000000"],
    ["X BOT CLUB XBOT", "58424F5400000000000000000000000000000000"],
    ["XRPL Coins xCoin", "78436F696E000000000000000000000000000000"],
    ["XCrusaders Xcrusader", "5863727573616465720000000000000000000000"],
    ["D.P.Monks Finance XDX", "XDX"],
    ["XGO", "XGO"],
    ["XList XLIST", "584C495354000000000000000000000000000000"],
    ["Ripple Fox XLM", "XLM"],
    ["xMalaya", "784D616C61796100000000000000000000000000"],
    ["VerseX XMEN", "584D454E00000000000000000000000000000000"],
    ["Xmetaversal XMETA", "584D455441000000000000000000000000000000"],
    ["Xoge Xoge", "586F676500000000000000000000000000000000"],
    ["XPUNKS XPUNK", "5850554E4B000000000000000000000000000000"],
    ["XRPL RAINFOREST XRAIN", "585241494E000000000000000000000000000000"],
    ["XRDoge Classic XRDC", "5852444300000000000000000000000000000000"],
    ["XRDOGE XRdoge", "5852646F67650000000000000000000000000000"],
    ["xRock Xrock", "58726F636B000000000000000000000000000000"],
    ["XRPandaa XRPanda", "585250616E646100000000000000000000000000"],
    ["XRPayNet XRPayNet", "58525061794E6574000000000000000000000000"],
    ["XRPH", "5852504800000000000000000000000000000000"],
    ["XR Shiba Inu XRSHIB", "5852534849420000000000000000000000000000"],
    ["Xshrooms xShroom", "785368726F6F6D00000000000000000000000000"],
    ["xSPECTAR xSPECTAR", "7853504543544152000000000000000000000000"],
    ["XSQUAD XSQUAD", "5853515541440000000000000000000000000000"],
    ["xSTIK xSTIK", "785354494B000000000000000000000000000000"],
    ["xToadz xToadz", "78546F61647A0000000000000000000000000000"],
    ["xTweet", "7854776565740000000000000000000000000000"],
    ["XUM Universal Money XUM", "XUM"],
    ["VerseX XVR", "XVR"],
    ["Meta Weapon XWAR", "5857415200000000000000000000000000000000"],
    ["XWM World Money XWM", "XWM"],
  ];

  function truncateStr(str, n = 6) {
    if (!str) return "";
    return str.length > n
      ? str.substr(0, n - 1) +
          "..." +
          str.substr(str.length - n, str.length - 1)
      : str;
  }

  const listItems = txResponse.map((i, index) => (
    <tr className="hover self-center center" key={index}>
      <td className="">{i.date}</td>
      <td className="">{truncateStr(i.from)}</td>
      <td className="">{truncateStr(i.to)}</td>
      <td className="">{i.asset}</td>
      <td className="">{i.amount}</td>
      <td className="">{truncateStr(i.txHash)}</td>
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
      <div className="place-items-center mt-16 flex flex-col items-center">
        <button className="btn btn-success rounded-lg shadow-md mb-4">
          <CSVLink
            filename={`XRPL_accounting_${Date.now()}.csv`}
            data={csvData}
          >
            Download
          </CSVLink>
        </button>
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
      return <option value={a[1]}>{a[0]}</option>;
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
          <div className="p-4 mr-5 flex flex-col gap-8 items-end w-1/4">
            <label className="w-full">
              <span>Address</span>
              <input
                type="text"
                placeholder=""
                className="input input-bordered w-full"
                value={sendingAddress}
                onChange={(event) => setSendingAddress(event.target.value)}
              />
            </label>
            <label className="w-full">
              <span>Source/Dest Tag</span>
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
              <span> Transaction Type</span>
              <select
                className="select select-bordered w-full"
                onChange={(event) => setTxType(event.target.value)}
              >
                <option value="">All</option>
                <option value="Payment">Payment</option>
                <option value="NFTokenAcceptOffer">NFTokenAcceptOffer</option>
              </select>
            </label>
          </div>
          <div className=" p-4 ml-5 flex flex-col gap-8 items-start w-1/4">
            <label className="w-full">
              <span>Tx Direction</span>
              <select
                className="select select-bordered w-full"
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="both">Both</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
              </select>
            </label>
            <label className="w-full">
              <span>Order By</span>
              <select
                className="select select-bordered w-full"
                onChange={(e) => setOrderBy(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
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
            <label className={`w-full ${asset == "custom" ? "" : "hidden"}`}>
              <span>Custom Currency Code</span>
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
            {isFetching ? "Fetching..." : "Submit"}
          </button>
        </div>
        {txResponse.length == 0 ? (
          <div className="mt-10"></div>
        ) : (
          <OperatorsList />
        )}
      </div>
    </div>
  );
}

export default App;
