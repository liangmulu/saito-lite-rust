const Transaction = require('../../lib/saito/transaction').default;
const PeerService = require('saito-js/lib/peer_service').default;
const ModTemplate = require('../../lib/templates/modtemplate');
const DreamControls = require('./lib/dream-controls');
const DreamSpace = require('./lib/dream-space');
const LimboMain = require('./lib/main');
const InvitationLink = require('./../../lib/saito/ui/modals/saito-link/saito-link');
const SaitoHeader = require('./../../lib/saito/ui/saito-header/saito-header');

class Limbo extends ModTemplate {
	constructor(app) {
		super(app);
		this.app = app;
		this.name = 'Limbo';
		this.chunks = [];
		this.localStream = null; // My Video or Audio Feed
		this.combinedStream = null;

		this.description =
			'Saito Dream Space: emit audio/video stream to arbitrary number of followers';
		this.categories = 'Utilities Communications';

		this.styles = ['/videocall/style.css', '/limbo/style.css'];
		this.icon_fa = 'fa-solid fa-satellite';

		this.stun = null;
		this.rendered = false;

		/*
		Indexed by public key of dreamer
		contains
		ts: (int) start time
		members: (array) people in the dream including dreamer
		description: (string) 
		*/
		this.dreams = {};

		//Browsers
		this.dreamer = null;
		this.upstream = new Map();
		this.downstream = new Map();
		//

		app.connection.on('limbo-toggle-video', () => {
			if (this.combinedStream) {
				this.combinedStream.getVideoTracks().forEach((track) => {
					track.enabled = !track.enabled;
				});
			}
		});

		app.connection.on('limbo-toggle-audio', () => {
			if (this.localStream) {
				this.localStream.getAudioTracks().forEach((track) => {
					track.enabled = !track.enabled;
				});
			}
		});

		app.connection.on('stun-track-event', (peerId, event) => {
			if (
				!this.dreamer ||
				!this.upstream.has(peerId) ||
				this.dreamer === this.publicKey
			) {
				return;
			}

			console.log('LIMBO: another remote stream added', event.track);

			if (event.streams.length === 0) {
				this.combinedStream.addTrack(event.track);
			} else {
				event.streams[0].getTracks().forEach((track) => {
					this.combinedStream.addTrack(track);
				});
			}

			//Forward to peers if peers already established!
			this.downstream.forEach((key, pc) => {
				if (event.streams.length === 0) {
					pc.addTrack(event.track);
				} else {
					event.streams[0].getTracks().forEach((track) => {
						pc.addTrack(track);
					});
				}
			});

			this.controls.startTime = this.dreams[this.dreamer].ts;
			this.controls.render(this.combinedStream);
		});

		app.connection.on(
			'stun-new-peer-connection',
			async (publicKey, peerConnection) => {
				if (!this.dreamer) {
					console.warn('No dreamer');
					return;
				}

				console.log('New Stun/LIMBO peer connection');

				if (this.downstream.has(publicKey)) {
					console.log('Forward audio/video to receiver!');
					this.combinedStream.getTracks().forEach((track) => {
						peerConnection.addTrack(track, this.combinedStream);
					});
					//Save peerConnection in downstream
					this.downstream.set(publicKey, peerConnection);
				}

				if (this.upstream.has(publicKey)) {
					console.log('Set sender');
					this.upstream.set(publicKey, peerConnection);
				}
			}
		);
	}

	async initialize(app) {
		await super.initialize(app);

		if (app.BROWSER) {
			try {
				this.stun = app.modules.returnFirstRespondTo('peer-manager');
			} catch (err) {
				console.warn('No Stun available');
			}
		}
	}

	returnServices() {
		let services = [];

		if (this.app.BROWSER == 0) {
			services.push(new PeerService(null, 'inception', ''));
		}
		return services;
	}

	respondTo(type, obj) {
		let mod_self = this;

		if (type === 'call-actions') {
			if (obj?.members) {
				return [
					{
						text: 'Broadcast',
						icon: 'fa-solid fa-tower-broadcast',
						callback: async function (app) {
							if (mod_self.dreamer) {
								await mod_self.sendKickTransaction(obj.members);
								mod_self.exitSpace();
								mod_self.toggleNotification(false);
							} else {
								mod_self.broadcastDream(obj.members);
								mod_self.toggleNotification(true);
							}
						}
					}
				];
			}
			return null;
		}

		//
		//Game-Menu passes the game_mod as the obj, so we can test if we even want to add the option
		//
		if (type == 'game-menu') {
			/*return {
				id: 'game-game',
				text: 'Game',
				submenus: [
					{
						parent: 'game-game',
						text: 'Record Game',
						id: 'record-stream',
						class: 'record-stream',
						callback: function (app, game_mod) {
							game_mod.menu.hideSubMenus();
							if (mod_self?.mediaRecorder) {
								mod_self.stop();
								document.getElementById(
									'record-stream'
								).textContent = 'Start Recording';
							} else {
								mod_self.record(game_mod.game.players);
								document.getElementById(
									'record-stream'
								).textContent = 'Stop Recording';
							}
						}
					}
				]
			};*/
			return null;
		}

		return super.respondTo(type, obj);
	}

	async render() {
		if (!this.app.BROWSER) {
			return;
		}

		if (this.app.options.theme) {
			let theme = this.app.options.theme[this.slug];

			if (theme != null) {
				this.app.browser.switchTheme(theme);
			}
		}

		if (this.main == null) {
			this.main = new LimboMain(this.app, this);
			this.header = new SaitoHeader(this.app, this);
			await this.header.initialize(this.app);
			this.addComponent(this.header);
			this.addComponent(this.main);
		}

		for (const mod of this.app.modules.returnModulesRespondingTo(
			'chat-manager'
		)) {
			let cm = mod.respondTo('chat-manager');
			cm.container = '.saito-sidebar.left';
			cm.render_manager_to_screen = 1;
			this.addComponent(cm);
		}

		console.log('rendering', this.main, this.header);

		await super.render();

		if (this.app.browser.returnURLParameter('dream')) {
			let dreamer = this.app.crypto.base64ToString(
				this.app.browser.returnURLParameter('dream')
			);
			this.dreamer = dreamer;
		}

		this.rendered = true;
	}

	async onPeerServiceUp(app, peer, service = {}) {
		//
		// For now, we will only check if moving into the space
		// maybe in the future, will announce if followed keys are hosting
		//
		if (!app.BROWSER || !this.browser_active) {
			return;
		}

		if (service.service === 'inception') {
			console.log('Limbo: onPeerServiceUp', service.service);

			this.app.network.sendRequestAsTransaction(
				'dream list',
				{},
				async (oldMap) => {
					console.log('********************');
					console.log(oldMap);
					console.log('********************');
					if (oldMap) {
						this.dreams = {};
						Object.keys(oldMap).forEach((key) => {
							this.dreams[key] = oldMap[key];
						});
					}

					this.app.connection.emit('limbo-populated', 'service');

					if (this.dreamer && this.dreams[this.dreamer]) {
						let c = await sconfirm(
							`Will join ${this.app.keychain.returnUsername(
								this.dreamer
							)}'s dream space`
						);
						if (c) {
							this.joinDream(this.dreamer);
						} else {
							window.history.pushState('', '', `/limbo/`);
						}
					}
				}
			);
		}
	}

	async broadcastDream(keylist = null) {
		this.localStream = null;
		this.externalMediaControl = false;

		if (this.browser_active) {
			this.controls = new DreamControls(this.app, this, '#limbo-main');
		} else {
			this.controls = null;
		}

		//
		// First check if any other modules are fetching media
		//
		const otherParties = this.app.modules.getRespondTos('media-request');
		if (otherParties.length > 0) {
			console.log('Include other media!');
			// We hope there is only 1!
			this.localStream = otherParties[0].localStream;
			this.additionalSources = otherParties[0].remoteStreams;
			this.externalMediaControl = true;
		} else {
			let includeCamera = await sconfirm('Add webcam to stream?');

			try {
				//
				// Get webcam video
				//
				if (includeCamera) {
					this.localStream =
						await navigator.mediaDevices.getUserMedia({
							video: true,
							audio: true // Capture microphone audio
						});
				} else {
					//
					// Get microphone input only
					//
					this.localStream =
						await navigator.mediaDevices.getUserMedia({
							audio: true // Capture microphone audio
						});
				}
			} catch (error) {
				console.error('Access to user media denied: ', error);
				salert(
					'Recording will continue without camera and/or microphone input'
				);
			}
		}

		// Set up the media recorder with the canvas stream
		// Create a new stream for the combined video and audio
		this.combinedStream = new MediaStream();

		//
		// Attempt to stream of the screen -- user has to select it
		// this should include any displayed video and audio...
		//
		let screenStream = await sconfirm('Share screen?');

		if (screenStream) {
			try {
				//const videoElemScreen = document.createElement('video');
				let constraint = this.browser_active ? 'exclude' : 'include';

				screenStream = await navigator.mediaDevices.getDisplayMedia({
					video: true,
					audio: false,
					selfBrowserSurface: constraint,
					monitorTypeSurfaces: 'include'
				});

				// Add the audio tracks from the screen and camera to the combined stream
				screenStream.getTracks().forEach((track) => {
					this.combinedStream.addTrack(track);
					track.onended = async () => {
						console.log('Stopping screen share');
						await this.sendKickTransaction();
						this.exitSpace();
						this.toggleNotification(false);
					};
				});
			} catch (error) {
				console.error('Access to screen denied: ', error);
				screenStream = false;
			}
		}

		if (this.localStream) {
			if (this.localStream.getAudioTracks().length > 0) {
				this.combinedStream.addTrack(
					this.localStream.getAudioTracks()[0]
				);
			}
			if (!screenStream && this.localStream.getVideoTracks().length > 0) {
				this.combinedStream.addTrack(
					this.localStream.getVideoTracks()[0]
				);
			}
		}

		if (this.controls) {
			this.controls.render(this.combinedStream, screenStream);
		}

		this.sendDreamTransaction();
		this.copyInviteLink(screenStream);
	}

	joinDream(dreamer) {
		this.controls = new DreamSpace(this.app, this, '#limbo-main');
		this.dreamer = dreamer;
		this.sendJoinTransaction();
		this.app.connection.emit('limbo-open-dream', dreamer);
		this.combinedStream = new MediaStream();
	}

	async sendDreamTransaction(keylist) {
		let newtx =
			await this.app.wallet.createUnsignedTransactionWithDefaultFee(
				this.publicKey
			);

		newtx.msg = {
			module: this.name,
			request: 'start dream'
		};

		if (keylist) {
			for (let key of keylist) {
				newtx.addTo(key);
			}
		}

		await newtx.sign();

		this.app.connection.emit('relay-transaction', newtx);
		this.app.network.propagateTransaction(newtx);

		console.log('sendDreamTransaction');
		this.receiveDreamTransaction(this.publicKey, newtx);
		this.app.connection.emit('limbo-open-dream', this.publicKey);
	}

	receiveDreamTransaction(sender, tx) {
		if (this.app.BROWSER) {
			if (this.publicKey == sender) {
				this.dreamer = this.publicKey;
				this.upstream = new Map();
				this.downstream = new Map();
			}

			if (tx.isTo(this.publicKey)) {
				this.toggleNotification(true);
			}
		}

		this.dreams[sender] = {
			members: [sender],
			ts: tx.timestamp
		};
	}

	async sendKickTransaction(keylist) {
		let newtx =
			await this.app.wallet.createUnsignedTransactionWithDefaultFee(
				this.publicKey
			);

		newtx.msg = {
			module: this.name,
			request: 'stop dream'
		};

		for (let key of this.dreams[this.publicKey].members){
			if (key !== this.publicKey){
				newtx.addTo(key);					
			}
		}

		if (keylist) {
			for (let key of keylist) {
				if (!newtx.isTo(key)){
					newtx.addTo(key);					
				}
			}
		}

		await newtx.sign();

		this.app.connection.emit('relay-transaction', newtx);
		this.app.network.propagateTransaction(newtx);
	}

	receiveKickTransaction(sender, tx) {
		if (this.dreams[sender]) {
			delete this.dreams[sender];
		} else {
			console.log('Sender not found...');
			console.log(sender, this.dreams, tx);
		}

		if (tx.isTo(this.publicKey)) {
			this.toggleNotification(false);
		}

		//
		// Don't process if not our dreamer
		//
		if (this.dreamer !== sender) {
			return;
		}

		if (this.dreamer !== this.publicKey) {
			siteMessage(
				`${this.app.keychain.returnUsername(this.dreamer)} woke up...`
			);
		}
		this.exitSpace();
	}

	async sendJoinTransaction() {
		if (!this.dreamer) {
			console.error('No dreamer to join');
		}

		let newtx =
			await this.app.wallet.createUnsignedTransactionWithDefaultFee(
				this.publicKey
			);

		newtx.msg = {
			module: this.name,
			request: 'join dream',
			dreamer: this.dreamer
		};

		newtx.addTo(this.dreamer);

		await newtx.sign();

		this.app.connection.emit('relay-transaction', newtx);
		this.app.network.propagateTransaction(newtx);
	}

	receiveJoinTransaction(sender, tx) {
		let txmsg = tx.returnMessage();

		let dreamer = txmsg.dreamer;

		if (!this.dreams[dreamer]) {
			return;
		}

		if (!this.dreams[dreamer].members.includes(sender)) {
			this.dreams[dreamer].members.push(sender);
		}

		if (this.app.BROWSER) {
			let peerCt = this.downstream.size;
			if (this.publicKey === this.dreamer) {
				peerCt += this.stun.peers.size;
			}
			if (
				this.publicKey !== sender &&
				this.combinedStream &&
				peerCt < 10
			) {
				this.sendOfferTransaction(sender);
				this.downstream.set(sender, null);
				setTimeout(() => {
					//Rescind offer after 90 seconds if not taken up
					if (
						this.downstream.has(sender) &&
						!this.downstream.get(sender)
					) {
						this.downstream.delete(sender);
					}
				}, 90000);
			}
		}
	}

	async sendLeaveTransaction() {
		if (!this.dreamer) {
			console.error('No dreamer to leave!');
		}

		if (this.dreamer === this.publicKey) {
			await this.sendKickTransaction();
			return;
		}

		let newtx =
			await this.app.wallet.createUnsignedTransactionWithDefaultFee(
				this.publicKey
			);

		newtx.msg = {
			module: this.name,
			request: 'leave dream',
			dreamer: this.dreamer
		};

		newtx.addTo(this.dreamer);

		await newtx.sign();

		this.app.connection.emit('relay-transaction', newtx);
		this.app.network.propagateTransaction(newtx);
	}

	receiveLeaveTransaction(sender, tx) {
		let txmsg = tx.returnMessage();

		let dreamer = txmsg.dreamer;

		console.log(`${sender} is leaving ${dreamer}'s dream`);

		if (
			!this.dreams[dreamer] ||
			!this.dreams[dreamer].members.includes(sender)
		) {
			console.log('nothing to remove');
			return;
		}

		let members = this.dreams[dreamer].members;
		for (let i = 0; i < members.length; i++) {
			if (members[i] == sender) {
				members.splice(i, 1);
				break;
			}
		}

		if (this.downstream.has(sender)) {
			let pc = this.downstream.get(sender);
			if (pc) {
				try {
					pc.close();
				} catch (err) {
					console.error(err);
				}
			}
			this.downstream.delete(sender);
		}

		if (this.upstream.has(sender)) {
			this.upstream.delete(sender);
			this.sendJoinTransaction();
		}
	}

	async sendOfferTransaction(target) {
		if (!this.dreamer) {
			console.error('No dreamer to join');
		}

		let newtx =
			await this.app.wallet.createUnsignedTransactionWithDefaultFee(
				target
			);

		newtx.msg = {
			module: this.name,
			request: 'offer dream',
			dreamer: this.dreamer
		};

		await newtx.sign();

		this.app.connection.emit('relay-transaction', newtx);
		this.app.network.propagateTransaction(newtx);

		console.log('Offer stream to ' + target);
	}

	receiveOfferTransaction(sender, tx) {
		if (!this.app.BROWSER) {
			return;
		}
		if (
			!this.dreamer ||
			this.upstream.size > 0 ||
			sender == this.publicKey
		) {
			return;
		}

		console.log('Confirm upstream from ' + sender);
		this.upstream.set(sender, 0);

		//Attempt to get connection
		this.stun.createPeerConnection(sender);
	}

	onConfirmation(blk, tx, conf) {
		if (tx == null) {
			return;
		}

		let message = tx.returnMessage();

		if (conf === 0) {
			if (message.module === 'Limbo') {
				if (this.hasSeenTransaction(tx)) return;

				console.log('ON CONFIRMATION: ', message);

				if (
					tx.isTo(this.publicKey) ||
					this.browser_active ||
					this.app.BROWSER == 0
				) {
					let sender = tx.from[0].publicKey;

					if (message.request === 'start dream') {
						this.receiveDreamTransaction(sender, tx);
					}
					if (message.request === 'stop dream') {
						this.receiveKickTransaction(sender, tx);
					}
					if (message.request === 'join dream') {
						this.receiveJoinTransaction(sender, tx);
					}
					if (message.request === 'leave dream') {
						this.receiveLeaveTransaction(sender, tx);
					}
					if (message.request === 'offer dream') {
						this.receiveOfferTransaction(sender, tx);
						//Important, we don't need server rebroadcasting this or standard UI updates
						return;
					}

					this.app.connection.emit('limbo-populated', 'tx');
					if (message?.dreamer === this.dreamer) {
						this.app.connection.emit(
							'limbo-open-dream',
							this.dreamer
						);
					}

					//
					// only servers notify lite-clients
					//
					if (this.app.BROWSER == 0 && this.app.SPVMODE == 0) {
						console.log(' ******** notifyPeers');
						this.notifyPeers(tx);
					}
				}
			}
		}
	}

	async handlePeerTransaction(app, tx = null, peer, mycallback) {
		if (tx == null) {
			return;
		}
		let txmsg = tx.returnMessage();

		if (txmsg.request === 'dream list') {
			if (mycallback) {
				mycallback(this.dreams);
				return 1;
			}

			return 0;
		}

		if (txmsg.request == 'limbo spv update') {
			tx = new Transaction(undefined, txmsg.data);
			txmsg = tx.returnMessage();
		}

		if (this.hasSeenTransaction(tx) || txmsg.module !== this.name) {
			return;
		}

		if (
			tx.isTo(this.publicKey) ||
			this.browser_active ||
			this.app.BROWSER == 0
		) {
			let sender = tx.from[0].publicKey;

			console.log('HANDLE PEER TRANSACTION: ', txmsg);

			if (txmsg.request === 'start dream') {
				this.receiveDreamTransaction(sender, tx);
			}
			if (txmsg.request === 'stop dream') {
				this.receiveKickTransaction(sender, tx);
			}
			if (txmsg.request === 'join dream') {
				this.receiveJoinTransaction(sender, tx);
			}
			if (txmsg.request === 'leave dream') {
				this.receiveLeaveTransaction(sender, tx);
			}
			if (txmsg.request === 'offer dream') {
				this.receiveOfferTransaction(sender, tx);
				//Important, we don't need server rebroadcasting this or standard UI updates
				return;
			}

			this.app.connection.emit('limbo-populated', 'tx');
			if (txmsg?.dreamer === this.dreamer) {
				this.app.connection.emit('limbo-open-dream', this.dreamer);
			}
		}

		return super.handlePeerTransaction(app, tx, peer, mycallback);
	}

	async notifyPeers(tx) {
		if (this.app.BROWSER == 1) {
			return;
		}
		let peers = await this.app.network.getPeers();
		console.log(' ******* Limbo server forward tx');
		for (let peer of peers) {
			if (peer.synctype == 'lite') {
				this.app.network.sendRequestAsTransaction(
					'limbo spv update',
					tx.toJson(),
					null,
					peer.peerIndex
				);
			}
		}
	}

	stop() {
		console.log('Stop Dreaming!');

		if (!this.externalMediaControl) {
			if (this.localStream) {
				this.localStream.getTracks().forEach((track) => track.stop());
				this.localStream = null;
			}
			if (this.combinedStream) {
				this.combinedStream.getTracks().forEach((track) => {
					track.onended = null;
					track.stop();
				});
				this.combinedStream = null;
			}
		}
	}

	exitSpace() {
		this.dreamer = null;

		this.downstream.forEach((value, key) => {
			console.log(key, value);
			if (value) {
				try {
					value.close();
				} catch (err) {
					console.error(err);
				}
			}
		});

		this.upstream.forEach((value, key) => {
			console.log(key, value);
			if (value) {
				try {
					value.close();
				} catch (err) {
					console.error(err);
				}
			}
		});

		// Need to notify and close these peer connections
		this.upstream.clear();
		this.downstream.clear();

		this.stop();

		if (this.controls) {
			this.controls.remove();
		}

		if (this.browser_active) {
			window.history.pushState('', '', `/limbo/`);
		}

		this.app.connection.emit('limbo-open-dream');
		this.controls = null;
	}


	copyInviteLink(truthy = false) {
		if (truthy) {
			/*
			Since there is a button in the UI now, no need to bother with this...
			let data = {
				name: 'Limbo',
				path: '/limbo/',
				dream: this.app.crypto.stringToBase64(this.publicKey)
			};

			let invite = new InvitationLink(this.app, this, data);
			invite.render();*/
		} else {
			try {

				let base64obj = this.app.crypto.stringToBase64(this.publicKey);
				let url1 = window.location.origin + '/limbo/';
				let link = `${url1}?dream=${base64obj}`;

				navigator.clipboard.writeText(link);
				siteMessage('Invite link copied to clipboard', 1500);
			} catch (err) {
				console.warn(err);
			}
		}
	}

	toggleNotification(value = true) {
		let vinyl = document.querySelector('.fa-tower-broadcast');
		if (vinyl) {
			if (value) {
				vinyl.classList.add('recording');
			} else {
				vinyl.classList.remove('recording');
			}
		}
	}
}

module.exports = Limbo;
