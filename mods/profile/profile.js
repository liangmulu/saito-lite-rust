const saito = require('../../lib/saito/saito');
const Transaction = require('../../lib/saito/transaction').default;
const ModTemplate = require('../../lib/templates/modtemplate');
const PhotoUploader = require('../../lib/saito/ui/saito-photo-uploader/saito-photo-uploader');
const UpdateDescription = require('./lib/ui/update-description');

class Profile extends ModTemplate {
	constructor(app) {
		super(app);
		this.app = app;
		this.name = 'Profile';
		this.description = 'Profile Module';
		this.archive_public_key;
		this.cache = {};

		app.connection.on('profile-fetch-content-and-update-dom',
			async (key) => {

				console.log('profile-fetch-content-and-update-dom');

				// 
				// If not cached, check archives
				// 
				if (!this.cache[key]) {
					this.cache[key] = {};
					
					if (this.app.keychain.isWatched(key)) {

						let returned_key = this.app.keychain.returnKey(key);

						if (returned_key?.profile) {

							if (returned_key.profile?.banner){
								this.cache[key].banner = await this.fetchProfileFromArchive("banner", returned_key.profile.banner);
							}

							if (returned_key.profile?.description){
								this.cache[key].description = await this.fetchProfileFromArchive("description", returned_key.profile.description);
							}

							if (returned_key.profile?.image){
								this.cache[key].image = await this.fetchProfileFromArchive("image", returned_key.profile.image);
							}
						
						}

					} else {

						//Check remote archives
						this.app.storage.loadTransactions(
							{ field1: "Profile", field2: key }, 
							async (txs) => {
								let data_found = {};
								if (txs?.length > 0) {
									//Go reverse order for oldest first
									for (let i = txs.length - 1; i >= 0; i--) {
										let txmsg = txs[i].returnMessage();
										console.log("Remote Archive Profile TX: ", txmsg);
										Object.assign(data_found, txmsg.data);
									}
								}

								Object.assign(this.cache[key], data_found);
								this.app.connection.emit('profile-update-dom', key, this.cache[key]);
							},
						null);

						return;
					}
				}
				
				this.app.connection.emit('profile-update-dom', key, this.cache[key]);

			}
		);

		app.connection.on('profile-edit-banner', () => {
			this.photoUploader = new PhotoUploader(
				this.app,
				this.mod,
				'banner'
			);
			this.photoUploader.callbackAfterUpload = async (photo) => {
				let banner = await this.app.browser.resizeImg(photo);
				this.sendProfileTransaction({ banner });
			};
			this.photoUploader.render(this.photo);
		});

		app.connection.on('profile-edit-description', (key) => {
			const elementId = `profile-description-${key}`;
			const element = document.querySelector(`#${elementId}`);
			this.updateDescription = new UpdateDescription(this.app, this);
			this.updateDescription.render(element.textContent);
		});

	}


	async onConfirmation(blk, tx, conf) {
		let txmsg = tx.returnMessage();
		if (conf == 0) {
			if (txmsg.request === 'update profile') {
				console.log("Profile onConfirmation");

				await this.receiveProfileTransaction(tx);

			}
		}
	}


	async onPeerServiceUp(app, peer, service = {}) {

		if (!app.BROWSER) {
			return;
		}

		if (service.service === 'archive') {

			for (let key of this.app.keychain.returnKeys()){

				if (!key?.profile && key.watched) {

					// Save an empty profile, so we don't keep querying on every page load... 
					// if we are watching them, we will get the tx when they update...
					//
					this.app.keychain.addKey(key.publicKey, { profile: {} });

					//
					//Check remote archives
					//
					await app.storage.loadTransactions(
						{ field1: "Profile", field2: key.publicKey }, 
						async (txs) => {
							let txs_found = {};
							
							// We want to get the most recent tx for description/image/banner
							if (txs?.length > 0) {
								for (let i = txs.length - 1; i >= 0; i--) {
									let txmsg = txs[i].returnMessage();
									for (let k in txmsg.data){
										txs_found[k] = txs[i];
									}
								}
							}

							for (let k in txs_found){
								await this.receiveProfileTransaction(txs_found[k]);
							}
						},

					null);
				}

			}
		}

	}

	/**
	 * Asynchronously sends a transaction to update a user's profile.
	 *
	 * @param {Object} data { image, banner, description, archive: {publicKey}}
	 *
	 **/
	async sendProfileTransaction(data) {

		this.app.connection.emit("saito-header-update-message", {msg: "broadcasting profile update"})

		let newtx =
			await this.app.wallet.createUnsignedTransactionWithDefaultFee(
				this.publicKey
			);
		newtx.msg = {
			module: this.name,
			request: 'update profile',
			data
		};
		
		await newtx.sign();

		this.app.connection.emit('profile-update-dom', this.publicKey, data);

		await this.app.network.propagateTransaction(newtx);

	}

	/**
	 * Processes a received transaction to update a user's profile.
	 *
	 * @param {Object} tx - The transaction object received, containing data to be processed.
	 **/
	async receiveProfileTransaction(tx) {

		let from = tx?.from[0]?.publicKey;

		if (!from) {
			console.error("Profile: Invalid TX");
			return;
		}

		let txmsg = tx.returnMessage();

		console.log("PROFILE UPDATE: ", txmsg.data);

		//
		// Update (server) cache with profile data
		//
		if (!this.cache[from]){
			this.cache[from] = {};
		}

		Object.assign(this.cache[from], txmsg.data);

		//
		// If we follow the key, save the indices (tx sig) in our keychain
		// and archive the transactions
 		//
		if (this.app.keychain.isWatched(from)) {

			let data = {};

			for (let key in txmsg.data) {
				if (key == "archive") {
					data[key] = txmsg.data[key];
				} else {
					data[key] = tx.signature;
				}
			}

			let returned_key = this.app.keychain.returnKey(from);

			let profile = Object.assign({}, returned_key?.profile);
			
			profile = Object.assign(profile, data);

			console.log(profile);

			this.app.keychain.addKey(from, { profile } );

			await this.saveProfileTransaction(tx);	

		}else if (!this.app.BROWSER){
			//
			// Save update transaction in archive if server 
			//
			await this.saveProfileTransaction(tx);	
		}

		//
		// Update my UI to confirm that tx was received on chain
		//
		if (tx.isFrom(this.publicKey)) {
			// Clear the saito-header notification from sendProfileTransaction
			this.app.connection.emit("saito-header-update-message", {msg: ""})
			siteMessage('Profile updated', 2000);
		}

		if (this.app.keychain.isWatched(from)){
			this.app.connection.emit('profile-update-dom', from, this.cache[from]);
		}

	}

	//
	//
	//  LOAD PROFILE VALUES FUNCTIONS
	//
 	async fetchProfileFromArchive(field, sig) {
 		return this.app.storage.loadTransactions({ sig, field1: 'Profile' },
			(txs) => {
				if (txs?.length > 0) {
					for (let tx of txs){
						let txmsg = tx.returnMessage();
						if (txmsg.data[field]){
							return txmsg.data[field];
						}
					}
				}
				return null;
			},
			'localhost');
 	}


	//
	// Every profile update saves a new transaction to the archive, and in the keychain 
	// we store the signature of the most recent update so that we can pull that up
	//
	async saveProfileTransaction(tx) {

		await this.app.storage.saveTransaction(
			tx,
			{ field1: 'Profile', preserve: 1 },
			'localhost'
		);
	}


}

module.exports = Profile;
