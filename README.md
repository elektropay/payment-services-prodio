# payment-services-prodio

Prodio-Payments is a express based facade to multiple payment services.  
The idea is an simple and inutive API to handle just simple single payments. It's als designed to add more payment services over time, but without changing the general API.

The service type is just one argument within the process.

For every provider the required messaging endpoint, like Cayan's Key, will be attached to express. So everything you need is included.

We believe that payments is a problem rooted in code, not finance. We obsessively seek out elegant, composable abstractions that enable robust, scalable, flexible integrations. Because we eliminate needless complexity and extraneous details, you can get up and running with the module in just a couple of minutes.

# Features

* Merchant 
	* Create Merchant
	* Get Merchant Activation Status
	* Get Merchant Profile
	* DeActivate Merchant
	* Remove Merchant

* Payees (Customers)
	* Add Payee
	* Edit Payee
	* Remove Payee(s)
	* Import Payees

* Cards
	* Add Card for Payee
	* Remove Card from Payee

* Payment Transaction
	* Process Payment
	* Get Payment Transactions (filter by mechant, payee, date, keyword etc.)

* Recurring Billing
	* Add Recurring Transaction
	* Edit Recurring Transaction
	* Remove Recurring Transaction

* Invoice
	* Create Invoice
	* Send Invoice

* Refund
	* Process Refund for Transaction

* Reports/Stats

* WebHooks.
 

### Currently Supported Payment Gateways

* [Cayan](https://cayan.com)


# Installation
1. Clone this repository on your server `git clone https://github.com/ProdioDesignWorks/payment-services-prodio.git`
2. Navigate to your repo `cd payment-services-prodio`
3. Install dependencies `npm install`
4. Start service `node .` or `npm start` or `node server/server.js`
5. Open `http://localhost:3010/explorer/` in your browser (Note: The port 3010 should be allowed in server firewall OR In the AWS Security Groups)
6. If you've pm2 installed then use this `pm2 start server/server.js --name="PAYMENT_SERVICE"`
#### NOTE: 
`payment-services-prodio` uses loopback as the core framework for developing API's, so all customisations, configurations, middlewares, events, and db connectors can be used which you would have used in loopback. 


## Tech
`payment-services-prodio` uses number of open source tools to work properly

* [nodejs](https://nodejs.org/) - evented I/O for the backend
* [mongodb](https://github.com/mongodb/mongo) - datastore
* [loopback](https://loopback.io/) highly nodejs framework for developing node API's


## TODO's

* A `sandbox` config setting to switch beween the sandbox and live environments.


## Work in progress

`payment-services-prodio` is work in progress. Your ideas, suggestions etc. are very welcome.


## The License

