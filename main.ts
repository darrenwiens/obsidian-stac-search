import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface StacSearchSettings {
	stacApiUrl: string;
}

const DEFAULT_SETTINGS: StacSearchSettings = {
	stacApiUrl: 'https://planetarycomputer.microsoft.com/api/stac/v1'
}

export default class StacSearchPlugin extends Plugin {
	settings: StacSearchSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('globe', 'STAC Search', (evt: MouseEvent) => {
			new StacSearchModal(this.app, this.settings, (result) => {
				new Notice(`STAC Search saved to: ${result}`);
			}).open();
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'stac-search-modal',
			name: 'Open STAC Search modal',
			callback: () => {
				new StacSearchModal(this.app, this.settings, (result) => {
					new Notice(`STAC Search saved to: ${result}`);
				}).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new StacSearchSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class StacSearchModal extends Modal {
	result: string;
	settings: any;
	onSubmit: (result: string) => void;

	constructor(app: App, settings: any, onSubmit: (result: string) => void) {
		super(app);
		this.settings = settings;
		this.onSubmit = onSubmit;
	}

	async onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "STAC Search" });

		async function fetchCollections(url: string) {
			return fetch(url + '/collections')
				.then(response => response.json())
				.then(collectionsResult => {
					return collectionsResult
				})
				.catch(error => {
					console.error(error);
				});
		}

		async function fetchItems(url: string, payload: object) {
			const jsonPayload = JSON.stringify(payload);
			const requestOptions = {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: jsonPayload
			};
			return fetch(url + '/search', requestOptions)
				.then(response => response.json())
				.then(itemsResult => {
					return itemsResult
				})
				.catch(error => {
					console.error(error);
				});
		}

		function createDateInput(dateStr: string) {
			const dateDiv = contentEl.createEl('div', { cls: 'setting-item' })
			const dateLblDiv = dateDiv.createEl('div', { cls: 'setting-item-info' });
			dateLblDiv.createEl('label', { cls: "setting-item-name" }).setText("Start Date:");
			const dateInputDiv = dateDiv.createEl('div', { cls: 'setting-item-control' });
			const dateInput = dateInputDiv.createEl('input', { cls: "setting-input" });
			dateInput.type = 'date';
			dateInput.id = 'myDateInput';
			dateInput.value = dateStr
			return dateInput
		}

		function createDate(offsetDays = 0) {
			const d = new Date();
			d.setDate(d.getDate() - offsetDays);
			return d.toISOString().split("T")[0];
		}

		const inputs = {
			stacApiUrl: this.settings.stacApiUrl,
			collection: 'sentinel-2-l2a',
			startDate: createDate(7),
			endDate: createDate(0),
			bbox: "-124,45,-123,46",
			output: "stac-search.md"
		}

		new Setting(contentEl)
			.setName("STAC API URL:")
			.addText((text) =>
				text
					.setValue(inputs.stacApiUrl)
					.onChange(async (value) => {
						inputs.stacApiUrl = value
						collectionsResult = await fetchCollections(value)

						const collectionIds = []
						for (const collection of collectionsResult.collections) {
							collectionIds.push(collection.id)
						}
						collectionIds.sort()
						console.log(collectionSelect)
						collectionSelect.clear()

						collectionSelect.addDropdown((dropdown) => {
							dropdown.addOption("", "Select a collection")
							for (const collection of collectionsResult.collections) {
								dropdown.addOption(collection.id, collection.id)
							}
							dropdown.setValue(inputs.collection)

							dropdown.onChange((value) => {
								console.log(value)
								inputs.collection = value
							})
						})
					})
			);

		let collectionsResult = await fetchCollections(inputs.stacApiUrl)
		const collectionIds = []
		for (const collection of collectionsResult.collections) {
			collectionIds.push(collection.id)
		}
		collectionIds.sort()

		const collectionSelect = new Setting(contentEl)
			.setName("STAC Collection:")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "Select a collection")
				for (const collection of collectionsResult.collections) {
					dropdown.addOption(collection.id, collection.id)
				}
				dropdown.setValue(inputs.collection)

				dropdown.onChange((value) => {
					console.log(value)
					inputs.collection = value
				})
			})

		const startDateInput = createDateInput(inputs.startDate)
		startDateInput.addEventListener('change', () => {
			console.log('startDateInput changed: ' + startDateInput.value);
			inputs.startDate = startDateInput.value
		})

		const endDateInput = createDateInput(inputs.endDate)
		endDateInput.addEventListener('change', () => {
			console.log('endDateInput changed: ' + endDateInput.value);
			inputs.endDate = endDateInput.value
		})

		new Setting(contentEl)
			.setName("Bounding Box w, s, e, n:")
			.addText((text) =>
				text
					.setValue(inputs.bbox)
					.onChange(async (value) => {
						inputs.bbox = value
					})
			);

		new Setting(contentEl)
			.setName("Output File:")
			.addText((text) =>
				text
					.setValue(inputs.output)
					.onChange(async (value) => {
						inputs.output = value
					})
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Submit")
					.setCta()
					.onClick(async () => {
						const payload = {
							"collections": [
								inputs.collection
							],
							"bbox": inputs.bbox.split(',').map(Number),
							"datetime": `${inputs.startDate}T00:00:00Z/${inputs.endDate}T23:59:59Z`
						}
						console.log('payload', payload)
						const items = await fetchItems(inputs.stacApiUrl, payload)

						const { vault } = this.app;
						vault.create(inputs.output, JSON.stringify(items, null, 2))

						this.close();
						this.onSubmit(inputs.output);
					}));
	}


	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class StacSearchSettingTab extends PluginSettingTab {
	plugin: StacSearchPlugin;

	constructor(app: App, plugin: StacSearchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('STAC API URL')
			.setDesc('Root URL for STAC API')
			.addText(text => text
				.setPlaceholder('Enter default STAC API URL')
				.setValue(this.plugin.settings.stacApiUrl)
				.onChange(async (value) => {
					this.plugin.settings.stacApiUrl = value;
					await this.plugin.saveSettings();
				}));
	}
}