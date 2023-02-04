# On-chain XRPL accounting

This repo contains apps meant to make on-chain accounting process easier

## Form fields explained:

**Sending Address and Source Tag:** r xxx address from account that initiated the transaction, along with if necessary the
source tag (for exchanges for example).

**Receiving Address and Destination Tag:** r xxx address from account that received the transaction, along with if
necessary the destination tag (for exchanges for example).

**From Date and To Date:** These are to provide the dates during which the transactions occurred. If no From Date
provided then fetch all transactions up to the To Date. If no To Date provided then fetch all the transactions up to the
most recent ledger entry.

**Asset:** This drop down should list All (default) followed by XRP, and then followed by all the top 100 issued assets on
the XRPL alphabetically. But crucially needs to have an “Other” field at the bottom, which allows the person to enter
either the 3 character currency string or the 160-bit currency hex to be able to use any issued asset on the XRPL.

**Order by:** Display most recent transactions first, or oldest transactions first.

**Transaction type:** All (default), Transfer, Purchase, Sale
This is so we can fetch the type of transaction they need, so transfer would be a payment from one address to another.
Purchase is a limit buy or market buy that has fulfilled. Sale is a limit sell or market sell that has fulfilled.

## How to setup

⚫go to xrpl subdirectory

⚫run `npm i` and wait for dependencies to finish downloading

⚫run `npm run dev`

⚫open localhost:3000 in your web browser to start using the app
