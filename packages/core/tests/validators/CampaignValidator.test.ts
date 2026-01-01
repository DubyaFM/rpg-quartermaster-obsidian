import { describe, it, expect } from 'vitest';
import { CampaignValidator, CampaignValidationError } from '../../validators/CampaignValidator';
import { CampaignProfile } from '../../services/CampaignManager';

describe('CampaignValidator', () => {
	const validCampaignId = 'campaign-12345678-1234-4321-8888-123456789012';
	const validWorldId = 'world-forgotten-realms';
	const validTimestamp = Date.now();

	const validProfile: CampaignProfile = {
		id: validCampaignId,
		name: 'My Campaign',
		worldId: validWorldId,
		createdAt: validTimestamp,
		lastAccessedAt: validTimestamp,
		isActive: true,
		description: 'A cool campaign',
		pathMappings: {
			shops: 'Shops/',
			party: 'Party Inventory.md',
			transactions: 'Transaction Log.md'
		},
		activeLibraryIds: ['library-12345678-1234-4321-8888-123456789012', 'srd']
	};

	describe('validate', () => {
		it('should return valid for a complete correct profile', () => {
			const result = CampaignValidator.validate(validProfile);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should return valid for a partial profile if isUpdate is true and ID is provided', () => {
			const result = CampaignValidator.validate({ id: validCampaignId, name: 'Updated Name' }, true);
			expect(result.valid).toBe(true);
		});

		it('should return invalid if name is missing and not an update', () => {
			const { name, ...invalidProfile } = validProfile;
			const result = CampaignValidator.validate(invalidProfile as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'name')).toBe(true);
		});

		it('should return invalid if worldId is missing and not an update', () => {
			const { worldId, ...invalidProfile } = validProfile;
			const result = CampaignValidator.validate(invalidProfile as any);
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'worldId')).toBe(true);
		});

		it('should return invalid if ID is missing and isUpdate is true', () => {
			const result = CampaignValidator.validate({ name: 'New Name' }, true);
			// Wait, ID is NOT required for update if we are just checking validity of the update object itself?
			// Checking implementation:
			// if (profile.id !== undefined) { ... } else if (isUpdate) { errors.push(new CampaignValidationError('id', 'Campaign ID is required for updates')); }
			// So yes, it should fail.
			const result2 = CampaignValidator.validate({ name: 'New Name' }, true);
			expect(result2.valid).toBe(false);
			expect(result2.errors.some(e => e.field === 'id')).toBe(true);
		});

		it('should validate description length', () => {
			const longDescription = 'a'.repeat(501);
			const result = CampaignValidator.validate({ ...validProfile, description: longDescription });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'description')).toBe(true);
		});

		it('should validate isActive type', () => {
			const result = CampaignValidator.validate({ ...validProfile, isActive: 'yes' as any });
			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.field === 'isActive')).toBe(true);
		});
	});

	describe('isValidCampaignId', () => {
		it('should return true for valid campaign ID format', () => {
			expect(CampaignValidator.isValidCampaignId('campaign-12345678-1234-4321-8888-123456789012')).toBe(true);
			expect(CampaignValidator.isValidCampaignId('campaign-00000000-0000-4000-a000-000000000000')).toBe(true);
		});

		it('should return false for invalid formats', () => {
			expect(CampaignValidator.isValidCampaignId('12345678-1234-4321-8888-123456789012')).toBe(false);
			expect(CampaignValidator.isValidCampaignId('campaign-123')).toBe(false);
			expect(CampaignValidator.isValidCampaignId('world-12345678-1234-4321-8888-123456789012')).toBe(false);
		});

		it('should return false for non-v4 UUIDs (v1 check)', () => {
			// v1 UUID has '1' in the version position
			expect(CampaignValidator.isValidCampaignId('campaign-12345678-1234-1321-8888-123456789012')).toBe(false);
		});
	});

	describe('isValidWorldId', () => {
		it('should return true for valid world ID format', () => {
			expect(CampaignValidator.isValidWorldId('world-test')).toBe(true);
			expect(CampaignValidator.isValidWorldId('world-my-cool-world-123')).toBe(true);
			expect(CampaignValidator.isValidWorldId('world-a')).toBe(true);
			expect(CampaignValidator.isValidWorldId('world-0')).toBe(true);
		});

		it('should return false for invalid formats', () => {
			expect(CampaignValidator.isValidWorldId('world-')).toBe(false);
			expect(CampaignValidator.isValidWorldId('test-world')).toBe(false);
			expect(CampaignValidator.isValidWorldId('world-Test')).toBe(false);
			expect(CampaignValidator.isValidWorldId('world-test_world')).toBe(false);
			expect(CampaignValidator.isValidWorldId('world--test')).toBe(false);
			expect(CampaignValidator.isValidWorldId('world-test-')).toBe(false);
			expect(CampaignValidator.isValidWorldId('world- ')).toBe(false);
			expect(CampaignValidator.isValidWorldId('world-!!!')).toBe(false);
		});
	});

	describe('validateName', () => {
		it('should return no errors for valid names', () => {
			expect(CampaignValidator.validateName('My Campaign')).toHaveLength(0);
			expect(CampaignValidator.validateName('A')).toHaveLength(0);
			expect(CampaignValidator.validateName('Name with 100 chars' + 'a'.repeat(81))).toHaveLength(0);
			expect(CampaignValidator.validateName('Campaign-123')).toHaveLength(0);
			expect(CampaignValidator.validateName('Campaign (Test)')).toHaveLength(0);
		});

		it('should return error for empty or whitespace name', () => {
			expect(CampaignValidator.validateName('')).toHaveLength(1);
			expect(CampaignValidator.validateName('   ')).toHaveLength(1);
			expect(CampaignValidator.validateName('\t')).toHaveLength(2); // empty + control char
			expect(CampaignValidator.validateName('\n')).toHaveLength(2); // empty + control char
		});

		it('should return error for names > 100 chars', () => {
			expect(CampaignValidator.validateName('a'.repeat(101))).toHaveLength(1);
			expect(CampaignValidator.validateName('a'.repeat(200))).toHaveLength(1);
		});

		it('should return error for non-string types', () => {
			expect(CampaignValidator.validateName(123 as any)).toHaveLength(1);
			expect(CampaignValidator.validateName(null as any)).toHaveLength(1);
			expect(CampaignValidator.validateName({} as any)).toHaveLength(1);
		});

		it('should return error for control characters', () => {
			expect(CampaignValidator.validateName('Campaign\nName')).toHaveLength(1);
			expect(CampaignValidator.validateName('Campaign\rName')).toHaveLength(1);
			expect(CampaignValidator.validateName('Campaign\x00Name')).toHaveLength(1);
			expect(CampaignValidator.validateName('Campaign\x1FName')).toHaveLength(1);
			expect(CampaignValidator.validateName('Campaign\x7FName')).toHaveLength(1);
		});
	});

	describe('validatePathMappings', () => {
		it('should return no errors for valid mappings', () => {
			const paths = {
				shops: 'Shops/',
				party: 'Party.md',
				transactions: 'Logs/'
			};
			expect(CampaignValidator.validatePathMappings(paths)).toHaveLength(0);
		});

		it('should allow optional keys', () => {
			const paths = {
				shops: 'S/',
				party: 'P.md',
				transactions: 'T.md',
				npcs: 'N/',
				calendar: 'C.json'
			};
			expect(CampaignValidator.validatePathMappings(paths)).toHaveLength(0);
		});

		it('should return error if required keys are missing', () => {
			expect(CampaignValidator.validatePathMappings({ shops: 'S/' } as any).some(e => e.message.includes('party'))).toBe(true);
			expect(CampaignValidator.validatePathMappings({ party: 'P/' } as any).some(e => e.message.includes('shops'))).toBe(true);
			expect(CampaignValidator.validatePathMappings({} as any)).toHaveLength(1);
		});

		it('should return error if paths are not strings or empty', () => {
			expect(CampaignValidator.validatePathMappings({ shops: '', party: 'P', transactions: 'T' })).toHaveLength(1);
			expect(CampaignValidator.validatePathMappings({ shops: 123 as any, party: 'P', transactions: 'T' })).toHaveLength(1);
			expect(CampaignValidator.validatePathMappings({ shops: 'S', party: null as any, transactions: 'T' })).toHaveLength(1);
		});

		it('should return error if input is not an object', () => {
			expect(CampaignValidator.validatePathMappings(null as any)).toHaveLength(1);
			expect(CampaignValidator.validatePathMappings([] as any)).toHaveLength(1); // Array is an object, but missing keys
			expect(CampaignValidator.validatePathMappings(['a'] as any)).toHaveLength(1); // Missing keys
		});
	});

	describe('validateLibraryIds', () => {
		it('should return no errors for valid library IDs', () => {
			expect(CampaignValidator.validateLibraryIds(['srd', 'library-12345678-1234-4321-8888-123456789012'])).toHaveLength(0);
			expect(CampaignValidator.validateLibraryIds([])).toHaveLength(0);
		});

		it('should return error for invalid formats', () => {
			expect(CampaignValidator.validateLibraryIds(['invalid'])).toHaveLength(1);
			expect(CampaignValidator.validateLibraryIds(['library-123'])).toHaveLength(1);
			expect(CampaignValidator.validateLibraryIds(['srd', 'not-srd'])).toHaveLength(1);
		});

		it('should return error for duplicates', () => {
			expect(CampaignValidator.validateLibraryIds(['srd', 'srd'])).toHaveLength(1);
			expect(CampaignValidator.validateLibraryIds(['library-12345678-1234-4321-8888-123456789012', 'library-12345678-1234-4321-8888-123456789012'])).toHaveLength(1);
		});

		it('should return error for non-array input', () => {
			expect(CampaignValidator.validateLibraryIds('srd' as any)).toHaveLength(1);
		});

		it('should return error for non-string elements', () => {
			expect(CampaignValidator.validateLibraryIds(['srd', 123 as any])).toHaveLength(1);
		});
	});

	describe('isValidTimestamp', () => {
		it('should return true for valid timestamps (2000-2100)', () => {
			expect(CampaignValidator.isValidTimestamp(Date.now())).toBe(true);
			expect(CampaignValidator.isValidTimestamp(946684800000)).toBe(true); // 2000
			expect(CampaignValidator.isValidTimestamp(4102444800000)).toBe(true); // 2100
		});

		it('should return false for out of range or invalid types', () => {
			expect(CampaignValidator.isValidTimestamp(0)).toBe(false);
			expect(CampaignValidator.isValidTimestamp(-1)).toBe(false);
			expect(CampaignValidator.isValidTimestamp(946684799999)).toBe(false); // just before 2000
			expect(CampaignValidator.isValidTimestamp(4102444800001)).toBe(false); // just after 2100
			expect(CampaignValidator.isValidTimestamp('now' as any)).toBe(false);
			expect(CampaignValidator.isValidTimestamp(NaN)).toBe(false);
		});
	});

	describe('validateOrThrow', () => {
		it('should not throw for valid profile', () => {
			expect(() => CampaignValidator.validateOrThrow(validProfile)).not.toThrow();
		});

		it('should throw CampaignValidationError for invalid profile', () => {
			expect(() => CampaignValidator.validateOrThrow({ ...validProfile, name: '' }))
				.toThrow(CampaignValidationError);
		});
	});
});
