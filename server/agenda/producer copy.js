
const Agenda = require('agenda');
const { MongoClient } = require('mongodb');

function scheduler(){
	this.init = async () => {
		try{
			const res = await this.run();
			await this.runSyncJobs();
		}catch(error){
			throw error;
		}
	}

	this.start = () => {
		this.agenda.start();
	}

	this.runSyncJobs = async () => {
		try{
			console.log(jobs);
			return;
		}catch(error){	
			throw error;
		}
	}

	this.createJob = async ({ jobId, data }) => {
		try{
			console.log(data);
			const { triggerAt } = data;
			await this.assignJobListener(jobId);
			const res = await this.agenda.schedule(new Date(triggerAt + 10000), jobId, data);
			console.log(res);
			return jobId;
		}catch(error){
			//remove job listener
			throw error;
		}
	}

	this.assignJobListener = jobName => {
		require('./jobs/jobs')(jobName, this.agenda);
		return;
	}

	this.run = async () => {
		try{
			this.agendaDB = await MongoClient.connect('mongodb://localhost:27017/agendatest');
			this.agenda = new Agenda().mongo(this.agendaDB, 'jobs');
			await this.agenda.once('ready');
			this.start();
			await this.runSyncJobs();
			return 'Ok';
		}catch(error){
			throw error;
		}
	}
};


exports.Scheduler = new scheduler();