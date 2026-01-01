// Bulk order execution modal for facilities
import { Modal, App, Setting, Notice } from 'obsidian';
import { Stronghold, CustomOrder, StrongholdFacility } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';

interface FacilityOrderSelection {
	facilityId: string;
	orderId?: string;
	variableAmount?: number;
	paymentSource: 'stronghold_stash' | 'party_treasury';
}

export class GiveOrdersModal extends Modal {
	plugin: QuartermasterPlugin;
	stronghold: Stronghold;
	strongholdFilePath: string;
	availableOrders: CustomOrder[] = [];
	orderSelections: Map<string, FacilityOrderSelection> = new Map();

	constructor(
		app: App,
		plugin: QuartermasterPlugin,
		stronghold: Stronghold,
		strongholdFilePath: string
	) {
		super(app);
		this.plugin = plugin;
		this.stronghold = stronghold;
		this.strongholdFilePath = strongholdFilePath;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('give-orders-modal');

		contentEl.createEl('h2', { text: `Give Orders - ${this.stronghold.name}` });

		await this.loadAvailableOrders();
		this.renderFacilities(contentEl);
		this.renderActions(contentEl);
	}

	async loadAvailableOrders() {
		try {
			this.availableOrders = await this.plugin.dataAdapter.loadOrders?.() || [];
		} catch (error) {
			console.error('Failed to load orders:', error);
			new Notice('Failed to load available orders');
		}
	}

	renderFacilities(container: HTMLElement) {
		const section = container.createDiv({ cls: 'facilities-section' });
		section.createEl('h3', { text: 'Facilities' });

		const idleFacilities = this.stronghold.facilities.filter(f => f.status === 'idle');
		const busyFacilities = this.stronghold.facilities.filter(f => f.status === 'busy');
		const inoperableFacilities = this.stronghold.facilities.filter(f => f.status === 'inoperable');

		if (idleFacilities.length === 0) {
			section.createEl('p', { text: 'No idle facilities available for orders' });
			return;
		}

		// Idle facilities (can receive orders)
		const idleSection = section.createDiv({ cls: 'idle-facilities' });
		idleSection.createEl('h4', { text: 'Idle Facilities' });

		idleFacilities.forEach(facility => {
			this.renderFacilityOrderSelection(idleSection, facility);
		});

		// Show busy facilities (read-only)
		if (busyFacilities.length > 0) {
			const busySection = section.createDiv({ cls: 'busy-facilities' });
			busySection.createEl('h4', { text: 'Busy Facilities' });

			busyFacilities.forEach(facility => {
				const facilityDiv = busySection.createDiv({ cls: 'facility-item busy' });
				facilityDiv.createEl('strong', { text: facility.name });
				facilityDiv.createEl('p', {
					text: `Busy until day ${facility.busyUntilDay}`
				});
			});
		}

		// Show inoperable facilities (read-only)
		if (inoperableFacilities.length > 0) {
			const inoperableSection = section.createDiv({ cls: 'inoperable-facilities' });
			inoperableSection.createEl('h4', { text: 'Inoperable Facilities' });

			inoperableFacilities.forEach(facility => {
				const facilityDiv = inoperableSection.createDiv({ cls: 'facility-item inoperable' });
				facilityDiv.createEl('strong', { text: facility.name });
				facilityDiv.createEl('p', { text: 'Facility is inoperable and cannot execute orders' });
			});
		}
	}

	renderFacilityOrderSelection(container: HTMLElement, facility: StrongholdFacility) {
		const facilityDiv = container.createDiv({ cls: 'facility-order-selection' });
		facilityDiv.createEl('h5', { text: facility.name });

		// Check if facility is operational (has required hirelings)
		const facilityTemplate = this.getFacilityTemplate(facility.templateId);
		const isOperational = facilityTemplate
			? facility.assignedHirelings.length >= facilityTemplate.hirelingsRequired
			: true;

		if (!isOperational) {
			facilityDiv.createEl('p', {
				text: `⚠️ Inoperable: Requires ${facilityTemplate?.hirelingsRequired} hirelings, has ${facility.assignedHirelings.length}`,
				cls: 'facility-warning'
			});
			return;
		}

		// Get available orders for this facility
		const facilityOrders = this.getOrdersForFacility(facility.templateId);

		if (facilityOrders.length === 0) {
			facilityDiv.createEl('p', { text: 'No orders available for this facility' });
			return;
		}

		// Initialize selection if not exists
		if (!this.orderSelections.has(facility.id)) {
			this.orderSelections.set(facility.id, {
				facilityId: facility.id,
				paymentSource: 'stronghold_stash'
			});
		}

		const selection = this.orderSelections.get(facility.id)!;

		// Order dropdown
		new Setting(facilityDiv)
			.setName('Select Order')
			.addDropdown(dropdown => {
				dropdown.addOption('', '-- No Order --');
				facilityOrders.forEach(order => {
					dropdown.addOption(order.id, order.name);
				});
				dropdown.setValue(selection.orderId || '');
				dropdown.onChange(value => {
					selection.orderId = value || undefined;
					this.onOpen();
				});
			});

		if (selection.orderId) {
			const selectedOrder = this.availableOrders.find(o => o.id === selection.orderId);

			if (selectedOrder) {
				// Show order details
				facilityDiv.createEl('p', { text: selectedOrder.description, cls: 'order-description' });
				facilityDiv.createEl('p', { text: `Time required: ${selectedOrder.timeRequired} days` });

				// Variable gold cost input
				if (selectedOrder.goldCost.type === 'variable') {
					new Setting(facilityDiv)
						.setName(selectedOrder.goldCost.prompt || 'Enter gold amount')
						.addText(text => text
							.setPlaceholder('0')
							.setValue(selection.variableAmount?.toString() || '')
							.onChange(value => {
								const num = parseInt(value);
								if (!isNaN(num) && num >= 0) {
									selection.variableAmount = num;
								}
							}));
				} else if (selectedOrder.goldCost.type === 'constant') {
					facilityDiv.createEl('p', { text: `Cost: ${selectedOrder.goldCost.amount || 0} gp` });
				}

				// Payment source
				new Setting(facilityDiv)
					.setName('Payment Source')
					.addDropdown(dropdown => {
						dropdown.addOption('stronghold_stash', 'Stronghold Stash');
						dropdown.addOption('party_treasury', 'Party Treasury');
						dropdown.setValue(selection.paymentSource);
						dropdown.onChange(value => {
							selection.paymentSource = value as 'stronghold_stash' | 'party_treasury';
						});
					});
			}
		}
	}

	getFacilityTemplate(templateId: string): any {
		// This should query the adapter, but for now return undefined
		// TODO: Cache facility templates in modal
		return undefined;
	}

	getOrdersForFacility(templateId: string): CustomOrder[] {
		return this.availableOrders.filter(order => {
			if (order.orderType === 'stronghold') {
				return true;
			}
			if (order.orderType === 'facility' && order.associatedFacilityIds) {
				return order.associatedFacilityIds.includes(templateId);
			}
			return false;
		});
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'modal-button-container' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Execute All Orders')
				.setCta()
				.onClick(async () => {
					await this.executeAllOrders();
				}));
	}

	async executeAllOrders() {
		const ordersToExecute = Array.from(this.orderSelections.values())
			.filter(selection => selection.orderId);

		if (ordersToExecute.length === 0) {
			new Notice('No orders selected');
			return;
		}

		// Validate all orders before execution (atomic)
		const validationErrors: string[] = [];

		for (const selection of ordersToExecute) {
			const order = this.availableOrders.find(o => o.id === selection.orderId);
			if (!order) {
				validationErrors.push(`Order ${selection.orderId} not found`);
				continue;
			}

			// Check variable cost provided
			if (order.goldCost.type === 'variable' && !selection.variableAmount) {
				validationErrors.push(`Order "${order.name}" requires a gold amount`);
			}

			// TODO: Validate gold availability, facility status, etc.
		}

		if (validationErrors.length > 0) {
			new Notice(`Validation failed:\n${validationErrors.join('\n')}`);
			return;
		}

		// Execute all orders
		try {
			let executedCount = 0;

			for (const selection of ordersToExecute) {
				const order = this.availableOrders.find(o => o.id === selection.orderId);
				const facility = this.stronghold.facilities.find(f => f.id === selection.facilityId);

				if (!order || !facility) continue;

				// Calculate completion day
				const currentDay = this.stronghold.metadata.calendarDay || 1;
				const completionDay = currentDay + order.timeRequired;

				// Update facility status
				facility.status = 'busy';
				facility.busyUntilDay = completionDay;
				// facility.currentOrder is not supported in the interface

				// TODO: Deduct gold from payment source
				// TODO: Log transaction

				executedCount++;
			}

			// Save updated stronghold
			this.stronghold.metadata.lastModified = new Date().toISOString();
			await this.plugin.dataAdapter.saveStronghold(this.stronghold);

			new Notice(`Successfully executed ${executedCount} orders!`);
			this.close();
		} catch (error) {
			console.error('Failed to execute orders:', error);
			new Notice('Failed to execute orders. See console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
