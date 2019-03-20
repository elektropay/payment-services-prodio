
const Agenda = require('agenda');
const { MongoClient } = require('mongodb');

const scheduler = {
	init: async () => {
		try{
			const res = await this.run();
			await this.runSyncJobs();
		}catch(error){
			throw error;
		}
	},
	start: () => {
		this.agenda.start();
	},
	runSyncJobs: async () => {
		try{
			console.log(jobs);
			return;
		}catch(error){	
			throw error;
		}
	},
	createJob: async ({ jobId, data }) => {
		try{
			console.log(data);
			const { triggerAt } = data;
			// await this.assignJobListener(jobId);
			const res = await this.agenda.schedule(new Date(triggerAt + 10000), jobId, data);
			console.log(res);
			return jobId;
		}catch(error){
			//remove job listener
			throw error;
		}
	},
	assignJobListener: jobName => {
		require('./jobs/jobs')(jobName, this.agenda);
		return;
	},
	run: async () => {
		try{
			this.agendaDB = await MongoClient.connect('mongodb://localhost:27017/agendatest');
			this.agenda = new Agenda().mongo(agendaDB, 'jobs');
			await new Promise(resolve => this.agenda.once('ready', resolve));
			this.start();
			await this.runSyncJobs();
			return 'Ok';
		}catch(error){
			throw error;
		}
	},
};

function Scheduler () {
	console.log(scheduler);
	const ss = Object.create(scheduler);
	console.log(ss);
  return ss;
}

exports.Scheduler = Scheduler();